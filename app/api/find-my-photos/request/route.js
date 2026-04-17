import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCloudinaryConfig, signCloudinaryParams } from "../../../../lib/cloudinary";

const MAX_SELFIE_BYTES = 10_485_760;

export async function POST(request) {
  try {
    const form = await request.formData();
    const fullName = String(form.get("fullName") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const consent = String(form.get("consent") || "") === "yes";
    const selfie = form.get("selfie");

    if (!fullName || !email || !consent || !(selfie instanceof File)) {
      return NextResponse.json(
        { error: "Full name, email, selfie, and consent are required." },
        { status: 400 }
      );
    }

    if (selfie.size > MAX_SELFIE_BYTES) {
      return NextResponse.json(
        { error: "Selfie file is too large. Maximum allowed is 10MB." },
        { status: 400 }
      );
    }

    const requestId = `fmp_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "adrah-joanna/find-my-photos/selfies";
    const publicId = requestId;
    const tags = "find_my_photos,selfie_request";
    const context = `request_id=${requestId}|full_name=${fullName}|email=${email}`;

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const signature = signCloudinaryParams(
      {
        folder,
        public_id: publicId,
        timestamp,
        context,
        tags
      },
      apiSecret
    );

    const uploadForm = new FormData();
    uploadForm.append("file", selfie);
    uploadForm.append("api_key", apiKey);
    uploadForm.append("timestamp", String(timestamp));
    uploadForm.append("signature", signature);
    uploadForm.append("folder", folder);
    uploadForm.append("public_id", publicId);
    uploadForm.append("context", context);
    uploadForm.append("tags", tags);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: uploadForm
    });
    const uploadBody = await uploadResponse.json().catch(() => ({}));

    if (!uploadResponse.ok) {
      return NextResponse.json(
        {
          error:
            uploadBody?.error?.message || uploadBody?.error || "Could not upload selfie request."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      requestId,
      statusUrl: `/find-my-photos/${requestId}`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to submit request." },
      { status: 500 }
    );
  }
}
