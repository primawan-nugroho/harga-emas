import { renderCardImage, renderSizeLadderImage } from "./render-image";
import { uploadDailyImage } from "./image-store";
import { publishToInstagram, publishCarouselToInstagram } from "./instagram";
import type { Analysis } from "./types";

/**
 * Slide 1 (the daily card) must succeed — it's the proven path, unchanged
 * since before carousels existed. Slide 2 (size ladder) is strictly
 * additive: any failure to render or upload it is swallowed here, and the
 * run proceeds with slide 1 alone rather than risk the daily post over a
 * nice-to-have extra slide.
 */
export async function renderSlides(analysis: Analysis): Promise<{ imageUrls: string[] }> {
  const slide1Buffer = await renderCardImage(analysis).arrayBuffer();
  const slide1Url = await uploadDailyImage(analysis.date, slide1Buffer);

  try {
    const slide2Buffer = await renderSizeLadderImage(analysis).arrayBuffer();
    const slide2Url = await uploadDailyImage(analysis.date, slide2Buffer, "sizes");
    return { imageUrls: [slide1Url, slide2Url] };
  } catch (e) {
    console.error("slide 2 (size ladder) render/upload failed, publishing slide 1 alone", e);
    return { imageUrls: [slide1Url] };
  }
}

/**
 * Publishes a carousel when there's more than one slide; falls back to the
 * single-image publish (slide 1 only) if the carousel publish itself fails
 * after retries — same guardrail as renderSlides: extra slides must never
 * be the reason the daily post doesn't go out.
 */
export async function publishWithFallback(
  imageUrls: string[],
  caption: string,
): Promise<{ mediaId: string; publishedSlides: number }> {
  if (imageUrls.length < 2) {
    const { mediaId } = await publishToInstagram({ imageUrl: imageUrls[0], caption });
    return { mediaId, publishedSlides: 1 };
  }
  try {
    const { mediaId } = await publishCarouselToInstagram({ imageUrls, caption });
    return { mediaId, publishedSlides: imageUrls.length };
  } catch (e) {
    console.error("carousel publish failed, falling back to single-image publish", e);
    const { mediaId } = await publishToInstagram({ imageUrl: imageUrls[0], caption });
    return { mediaId, publishedSlides: 1 };
  }
}
