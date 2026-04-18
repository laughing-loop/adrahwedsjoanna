import { NextResponse } from "next/server";
import { getCloudinaryConfig } from "../../../../lib/cloudinary";
import { findMyPhotosTags } from "../../../../lib/find-my-photos";

const SELFIES_FOLDER = "adrah-joanna/find-my-photos/selfies";
const MATCHES_FOLDER_ROOT = "adrah-joanna/find-my-photos/matches";
const GALLERY_FOLDER = "adrah-joanna/wedding-images";

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

export async function GET(request) {
  try {
    const requestId = request.nextUrl.searchParams.get("requestId") || "";
    if (!isValidRequestId(requestId)) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }

    // Prefer context-based lookup because it is stable even when public_id includes folder prefixes.
    const selfieExpressionByContext = `resource_type:image AND folder:${SELFIES_FOLDER} AND context.request_id=${requestId}`;
    const selfieExpressionByPublicId = `resource_type:image AND folder:${SELFIES_FOLDER} AND public_id=${requestId}`;
    const selfieExpressionByTag = `resource_type:image AND folder:${SELFIES_FOLDER} AND tags=request_${requestId}`;

    let selfie = await cloudinaryGetImageResource(`${SELFIES_FOLDER}/${requestId}`);
    let selfieMatches = selfie ? [selfie] : [];

    if (!selfieMatches.length) {
      selfieMatches = await cloudinarySearch(selfieExpressionByContext);
    }
    if (!selfieMatches.length) {
      selfieMatches = await cloudinarySearch(selfieExpressionByPublicId);
    }
    if (!selfieMatches.length) {
      selfieMatches = await cloudinarySearch(selfieExpressionByTag);
    }

    if (!selfieMatches.length) {
      return NextResponse.json({ status: "not_found", message: "Request not found." });
    }
    selfie = selfieMatches[0];
    const selfieTags = new Set(selfie.tags || []);
    const timing = buildTimingMeta(selfie);

    const [matchedImages, galleryProbe] = await Promise.all([
      cloudinarySearch(`resource_type:image AND folder:${MATCHES_FOLDER_ROOT}/${requestId}`),
      cloudinarySearch(`resource_type:image AND folder:${GALLERY_FOLDER}`, 1)
    ]);

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_NO_MATCH)) {
      return NextResponse.json({
        status: "no_match",
        message: "We completed the scan but found no matches yet. Try again after more photos are uploaded.",
        ...timing
      });
    }

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

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_READY)) {
      return NextResponse.json({
        status: "ready",
        message: "Your request is marked complete. Matches should appear shortly.",
        ...timing,
        images: []
      });
    }

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_ERROR)) {
      return NextResponse.json({
        status: "retrying",
        message:
          "We hit a temporary processing issue, but your request will retry automatically on the next matcher run.",
        ...timing,
        hasGalleryImages: galleryProbe.length > 0
      });
    }

    if (selfieTags.has(findMyPhotosTags.REQUEST_TAG_PROCESSING)) {
      return NextResponse.json({
        status: "matching",
        message: "Your selfie is being compared against wedding photos now.",
        ...timing,
        hasGalleryImages: galleryProbe.length > 0
      });
    }

    return NextResponse.json({
      status: "queued",
      message:
        "Your request is in queue. Matching runs automatically every 15 minutes while new wedding photos are processed.",
      ...timing,
      hasGalleryImages: galleryProbe.length > 0
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to fetch request status." },
      { status: 500 }
    );
  }
}
