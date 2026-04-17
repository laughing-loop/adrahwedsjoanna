import { getCloudinaryConfig, signCloudinaryParams } from "./cloudinary";

const REQUEST_TAG_PENDING = "match_pending";
const REQUEST_TAG_READY = "match_ready";
const REQUEST_TAG_NO_MATCH = "match_no_match";
const SELFIE_FOLDER = "adrah-joanna/find-my-photos/selfies";
const GALLERY_FOLDER = "adrah-joanna/wedding-images";
const MATCHES_FOLDER_ROOT = "adrah-joanna/find-my-photos/matches";
const DEFAULT_SIMILARITY_THRESHOLD = 0.92;

function getCompreFaceConfig() {
  const baseUrl = process.env.COMPRE_FACE_BASE_URL;
  const apiKey = process.env.COMPRE_FACE_API_KEY;
  const verifyPath = process.env.COMPRE_FACE_VERIFY_PATH || "/api/v1/verification/face";

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing CompreFace config. Set COMPRE_FACE_BASE_URL and COMPRE_FACE_API_KEY."
    );
  }

  return { baseUrl, apiKey, verifyPath };
}

function getCloudinaryAuthHeader() {
  const { apiKey, apiSecret } = getCloudinaryConfig();
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

function buildPreviewUrl(secureUrl) {
  if (!secureUrl?.includes("/upload/")) return secureUrl;
  return secureUrl.replace("/upload/", "/upload/f_jpg,q_auto,w_1200,c_limit/");
}

async function cloudinarySearch(expression, maxResults = 200) {
  const { cloudName } = getCloudinaryConfig();
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/search`, {
    method: "POST",
    headers: {
      Authorization: getCloudinaryAuthHeader(),
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

async function cloudinaryAddTag(tag, publicIds) {
  if (!publicIds.length) return;
  const { cloudName } = getCloudinaryConfig();
  const payload = new URLSearchParams();
  publicIds.forEach((publicId) => payload.append("public_ids[]", publicId));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/tags/${tag}`,
    {
      method: "POST",
      headers: {
        Authorization: getCloudinaryAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload
    }
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.error || "Could not set resource tag.");
  }
}

async function fetchAsBytes(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch media bytes from ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function normalizeThreshold(rawValue) {
  if (!Number.isFinite(rawValue) || rawValue <= 0) return DEFAULT_SIMILARITY_THRESHOLD;
  if (rawValue > 1) return rawValue / 100;
  return rawValue;
}

function collectSimilarityScores(value, scores) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSimilarityScores(item, scores));
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, next] of Object.entries(value)) {
    const keyName = key.toLowerCase();
    if (
      (keyName.includes("similarity") || keyName.includes("confidence")) &&
      typeof next === "number"
    ) {
      scores.push(next > 1 ? next / 100 : next);
    } else {
      collectSimilarityScores(next, scores);
    }
  }
}

function getRequestIdFromSelfie(selfiePublicId) {
  return selfiePublicId.split("/").pop();
}

function getPublicIdLeaf(publicId) {
  return publicId.split("/").pop();
}

async function copyImageToMatchesFolder(sourceUrl, requestId, originalPublicId) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `${MATCHES_FOLDER_ROOT}/${requestId}`;
  const publicId = `${getPublicIdLeaf(originalPublicId)}-${timestamp}`;

  const signature = signCloudinaryParams(
    {
      folder,
      public_id: publicId,
      overwrite: true,
      timestamp,
      tags: `find_my_photos,request_${requestId}`
    },
    apiSecret
  );

  const formData = new FormData();
  formData.append("file", sourceUrl);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("public_id", publicId);
  formData.append("overwrite", "true");
  formData.append("tags", `find_my_photos,request_${requestId}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.error || "Could not copy matched image.");
  }
}

async function compareFace(selfieBytes, galleryBytes) {
  const similarityThreshold = normalizeThreshold(
    Number(process.env.FIND_MY_PHOTOS_SIMILARITY || DEFAULT_SIMILARITY_THRESHOLD)
  );
  const { baseUrl, apiKey, verifyPath } = getCompreFaceConfig();
  const verifyUrl = new URL(verifyPath, baseUrl).toString();

  const formData = new FormData();
  formData.append("source_image", new Blob([selfieBytes]), "selfie.jpg");
  formData.append("target_image", new Blob([galleryBytes]), "gallery.jpg");

  const response = await fetch(verifyUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey
    },
    body: formData
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || body?.error || "CompreFace verification failed.");
  }

  const scores = [];
  collectSimilarityScores(body, scores);
  if (!scores.length) return false;
  return Math.max(...scores) >= similarityThreshold;
}

async function processSingleRequest(selfie, galleryImages) {
  const requestId = getRequestIdFromSelfie(selfie.public_id);
  const existingMatchExpression = `resource_type:image AND folder:${MATCHES_FOLDER_ROOT}/${requestId}`;
  const existingMatches = await cloudinarySearch(existingMatchExpression, 5);
  if (existingMatches.length) {
    await cloudinaryAddTag(REQUEST_TAG_READY, [selfie.public_id]);
    return { requestId, matchedCount: existingMatches.length, skipped: true };
  }

  const selfieBytes = await fetchAsBytes(buildPreviewUrl(selfie.secure_url));
  let matchCount = 0;

  for (const gallery of galleryImages) {
    const galleryBytes = await fetchAsBytes(buildPreviewUrl(gallery.secure_url));
    const matched = await compareFace(selfieBytes, galleryBytes);
    if (!matched) continue;
    await copyImageToMatchesFolder(gallery.secure_url, requestId, gallery.public_id);
    matchCount += 1;
  }

  if (matchCount > 0) {
    await cloudinaryAddTag(REQUEST_TAG_READY, [selfie.public_id]);
  } else {
    await cloudinaryAddTag(REQUEST_TAG_NO_MATCH, [selfie.public_id]);
  }

  return { requestId, matchedCount: matchCount, skipped: false };
}

export async function runPendingFindMyPhotosMatching() {
  const pendingExpression = `resource_type:image AND folder:${SELFIE_FOLDER} AND tags=${REQUEST_TAG_PENDING} AND NOT (tags=${REQUEST_TAG_READY} OR tags=${REQUEST_TAG_NO_MATCH})`;
  const galleryExpression = `resource_type:image AND folder:${GALLERY_FOLDER}`;

  const [pendingSelfies, galleryImages] = await Promise.all([
    cloudinarySearch(pendingExpression, 100),
    cloudinarySearch(galleryExpression, 300)
  ]);

  const processed = [];
  for (const selfie of pendingSelfies) {
    const outcome = await processSingleRequest(selfie, galleryImages);
    processed.push(outcome);
  }

  return {
    processedCount: processed.length,
    processed
  };
}

export const findMyPhotosTags = {
  REQUEST_TAG_PENDING,
  REQUEST_TAG_READY,
  REQUEST_TAG_NO_MATCH
};
