import { describe, it, expect, vi, beforeEach } from "vitest";

const fakeImageResponse = { arrayBuffer: async () => new ArrayBuffer(1) };

vi.mock("./render-image", () => ({
  renderCardImage: vi.fn(() => fakeImageResponse),
  renderSizeLadderImage: vi.fn(() => fakeImageResponse),
}));
vi.mock("./image-store", () => ({
  uploadDailyImage: vi.fn(async (_date: string, _buf: ArrayBuffer, slide?: string) =>
    slide ? `https://blob.test/images/x-${slide}.png` : "https://blob.test/images/x.png",
  ),
}));
vi.mock("./instagram", () => ({
  publishToInstagram: vi.fn(async () => ({ mediaId: "single-media-id" })),
  publishCarouselToInstagram: vi.fn(async () => ({ mediaId: "carousel-media-id" })),
}));

import { renderSlides, publishWithFallback } from "./carousel";
import { renderSizeLadderImage } from "./render-image";
import { publishCarouselToInstagram, publishToInstagram } from "./instagram";
import type { Analysis } from "./types";

const fakeAnalysis = {} as Analysis; // renderSlides only threads this through to the (mocked) renderers

describe("renderSlides — additive-slide guardrail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns both slide URLs when slide 2 renders fine", async () => {
    const { imageUrls } = await renderSlides(fakeAnalysis);
    expect(imageUrls).toEqual(["https://blob.test/images/x.png", "https://blob.test/images/x-sizes.png"]);
  });

  it("falls back to slide 1 alone when slide 2's render throws — never blocks the post", async () => {
    vi.mocked(renderSizeLadderImage).mockImplementationOnce(() => {
      throw new Error("size ladder render blew up");
    });

    const { imageUrls } = await renderSlides(fakeAnalysis);
    expect(imageUrls).toEqual(["https://blob.test/images/x.png"]);
  });
});

describe("publishWithFallback — carousel-publish guardrail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes a single image directly when there's only one slide", async () => {
    const { mediaId, publishedSlides } = await publishWithFallback(["https://blob.test/x.png"], "caption");
    expect(mediaId).toBe("single-media-id");
    expect(publishedSlides).toBe(1);
    expect(publishCarouselToInstagram).not.toHaveBeenCalled();
  });

  it("publishes a carousel when there are 2+ slides", async () => {
    const { mediaId, publishedSlides } = await publishWithFallback(
      ["https://blob.test/x.png", "https://blob.test/x-sizes.png"],
      "caption",
    );
    expect(mediaId).toBe("carousel-media-id");
    expect(publishedSlides).toBe(2);
  });

  it("falls back to single-image publish when the carousel publish itself fails", async () => {
    vi.mocked(publishCarouselToInstagram).mockRejectedValueOnce(new Error("carousel API rejected"));

    const { mediaId, publishedSlides } = await publishWithFallback(
      ["https://blob.test/x.png", "https://blob.test/x-sizes.png"],
      "caption",
    );
    expect(mediaId).toBe("single-media-id");
    expect(publishedSlides).toBe(1);
    expect(publishToInstagram).toHaveBeenCalledWith({ imageUrl: "https://blob.test/x.png", caption: "caption" });
  });
});
