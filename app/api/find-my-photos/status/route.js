import { NextResponse } from "next/server";
import { getCloudinaryConfig } from "../../../../lib/cloudinary";

function isValidRequestId(value) {
  return /^fmp_[a-z0-9]{20}$/i.test(value);
}

async function cloudinarySearch(expression) {
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
      max_results: 50
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || "Cloudinary search failed.");
  }
  return body.resources || [];
}

export async function GET(request) {
  try {
    const requestId = request.nextUrl.searchParams.get("requestId") || "";
    if (!isValidRequestId(requestId)) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }

    const selfieExpression = `resource_type:image AND folder:adrah-joanna/find-my-photos/selfies AND public_id:${requestId}`;
    const selfieMatches = await cloudinarySearch(selfieExpression);
    if (!selfieMatches.length) {
      return NextResponse.json({ status: "not_found", message: "Request not found." });
    }

    const resultsExpression = `resource_type:image AND folder:adrah-joanna/find-my-photos/matches/${requestId}`;
    const matchedImages = await cloudinarySearch(resultsExpression);

    if (!matchedImages.length) {
      return NextResponse.json({
        status: "processing",
        message:
          "Your request is in queue. Please check back shortly while photos are being matched."
      });
    }

    return NextResponse.json({
      status: "ready",
      images: matchedImages.map((item) => ({
        secureUrl: item.secure_url,
        thumbUrl: item.secure_url?.replace(
          "/upload/",
          "/upload/f_auto,q_auto,w_800,c_limit/"
        ),
        publicId: item.public_id
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to fetch request status." },
      { status: 500 }
    );
  }
}
