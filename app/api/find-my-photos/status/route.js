import { NextResponse } from "next/server";
import { getCloudinaryConfig } from "../../../../lib/cloudinary";
import { findMyPhotosTags } from "../../../../lib/find-my-photos";

const SELFIES_FOLDER = "adrah-joanna/find-my-photos/selfies";
const MATCHES_FOLDER_ROOT = "adrah-joanna/find-my-photos/matches";

function isValidRequestId(value) {
  return /^fmp_[a-z0-9]{20}$/i.test(value);
}

async function cloudinarySearch(expression, maxResults = 50) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/search`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      expression,
      max_results: maxResults
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || "Cloudinary search failed.");
  }
  return body.resources || [];
}

async function cloudinaryGetImageResource(publicId) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const encodedPublicId = encodeURIComponent(publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodedPublicId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`
      }
    }
  );

  if (response.status === 404) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || "Cloudinary resource lookup failed.");
  }

  return body;
}

function buildTimingMeta(selfie) {
  const submittedAt = selfie?.created_at || selfie?.uploaded_at || null;
  const updatedAt = selfie?.last_updated || selfie?.created_at || null;
  const submittedTs = submittedAt ? Date.parse(submittedAt) : NaN;
  const ageMinutes = Number.isFinite(submittedTs)
    ? Math.max(0, Math.floor((Date.now() - submittedTs) / 60000))
    : null;

  return {
    submittedAt,
    updatedAt,
    ageMinutes
  };
}

function isCloudinaryRateLimitMessage(message) {
  return /rate limit exceeded/i.test(String(message || ""));
}

function extractRetryAt(message) {
  const match = String(message || "").match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/i);
  return match ? match[0] : null;
}

export async function GET(request) {
  try {
    const requestId = request.nextUrl.searchParams.get("requestId") || "";
    if (!isValidRequestId(requestId)) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }

    let selfie = await cloudinaryGetImageResource(`${SELFIES_FOLDER}/${requestId}`);
    const selfieMatches = selfie
      ? [selfie]
      : await cloudinarySearch(
          `resource_type:image AND folder:${SELFIES_FOLDER} AND tags=request_${requestId}`,
          1
        );

    if (!selfieMatches.length) {
      return NextResponse.json({ status: "not_found", message: "Request not found." });
    }
    selfie = selfieMatches[0];
    const selfieTags = new Set(selfie.tags || []);
    const timing = buildTimingMeta(selfie);

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_NO_MATCH)) {
      return NextResponse.json({
        status: "no_match",
        message: "We completed the scan but found no matches yet. Try again after more photos are uploaded.",
        ...timing
      });
    }

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_ERROR)) {
      return NextResponse.json({
        status: "retrying",
        message:
          "We hit a temporary processing issue, but your request will retry automatically on the next matcher run.",
        ...timing
      });
    }

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_PROCESSING)) {
      return NextResponse.json({
        status: "matching",
        message: "Your selfie is being compared against wedding photos now.",
        ...timing
      });
    }

    if (
      selfieTags.has(findMyPhotosTags.REQUEST_TAG_READY) ||
      selfieTags.has(findMyPhotosTags.REQUEST_TAG_PENDING)
    ) {
      const matchedImages = await cloudinarySearch(
        `resource_type:image AND folder:${MATCHES_FOLDER_ROOT}/${requestId}`
      );

      if (matchedImages.length) {
        return NextResponse.json({
          status: "ready",
          message: `Your matched photos are ready (${matchedImages.length}).`,
          ...timing,
          images: matchedImages.map((item) => ({
            secureUrl: item.secure_url,
            thumbUrl: item.secure_url?.replace("/upload/", "/upload/f_auto,q_auto,w_800,c_limit/"),
            publicId: item.public_id
          }))
        });
      }
    }

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_READY)) {
      return NextResponse.json({
        status: "ready",
        message: "Your request is marked complete. Matches should appear shortly.",
        ...timing,
        images: []
      });
    }

    return NextResponse.json({
      status: "queued",
      message:
        "Your request is in queue. Matching runs automatically once daily on this deployment, or sooner if the admin runs matcher manually.",
      ...timing
    });
  } catch (error) {
    const message = error?.message || "Unable to fetch request status.";
    if (isCloudinaryRateLimitMessage(message)) {
      const retryAt = extractRetryAt(message);
      return NextResponse.json(
        {
          error: retryAt
            ? `Cloudinary API limit reached. Try again after ${retryAt}.`
            : "Cloudinary API limit reached. Try again later.",
          retryAt
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
