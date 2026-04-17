import { NextResponse } from "next/server";
import { canUpload, readSessionFromRequest } from "../../../../lib/auth";
import { getCloudinaryConfig, signCloudinaryParams } from "../../../../lib/cloudinary";

const ALLOWED_RESOURCE_TYPES = new Set(["image", "video"]);

export async function POST(request) {
  try {
    const session = readSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!canUpload(session.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const resourceType = ALLOWED_RESOURCE_TYPES.has(body?.resourceType)
      ? body.resourceType
      : "image";

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder =
      resourceType === "video"
        ? "adrah-joanna/wedding-videos"
        : "adrah-joanna/wedding-images";

    const signature = signCloudinaryParams({ folder, timestamp }, apiSecret);

    return NextResponse.json({
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to sign upload request." },
      { status: 500 }
    );
  }
}
