"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function isSwipeGesture(deltaX, deltaY) {
  return Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY);
}

function preloadImage(src) {
  if (typeof window === "undefined" || !src) return;
  const image = new window.Image();
  image.src = src;
}

export default function GalleryLightbox({ items }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const touchStartRef = useRef(null);

  const isOpen = Number.isInteger(activeIndex);
  const itemCount = items.length;

  const closeLightbox = useCallback(() => setActiveIndex(null), []);

  const showNext = useCallback(() => {
    setActiveIndex((current) => {
      if (!Number.isInteger(current)) return 0;
      return (current + 1) % itemCount;
    });
  }, [itemCount]);

  const showPrevious = useCallback(() => {
    setActiveIndex((current) => {
      if (!Number.isInteger(current)) return 0;
      return (current - 1 + itemCount) % itemCount;
    });
  }, [itemCount]);

  const activeItem = Number.isInteger(activeIndex) ? items[activeIndex] : null;
  const nextItem = useMemo(() => {
    if (!Number.isInteger(activeIndex) || !itemCount) return null;
    return items[(activeIndex + 1) % itemCount];
  }, [activeIndex, itemCount, items]);
  const previousItem = useMemo(() => {
    if (!Number.isInteger(activeIndex) || !itemCount) return null;
    return items[(activeIndex - 1 + itemCount) % itemCount];
  }, [activeIndex, itemCount, items]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowRight") {
        showNext();
      } else if (event.key === "ArrowLeft") {
        showPrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeLightbox, isOpen, showNext, showPrevious]);

  useEffect(() => {
    if (!isOpen) return;
    preloadImage(nextItem?.src);
    preloadImage(previousItem?.src);
  }, [isOpen, nextItem?.src, previousItem?.src]);

  const onTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event) => {
    const origin = touchStartRef.current;
    if (!origin) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;
    if (isSwipeGesture(deltaX, deltaY)) {
      if (deltaX < 0) showNext();
      if (deltaX > 0) showPrevious();
    }
    touchStartRef.current = null;
  };

  const onTouchCancel = () => {
    touchStartRef.current = null;
  };

  return (
    <>
      <div className="gallery-grid">
        {items.map((item, index) => (
          <button
            key={item.alt}
            type="button"
            className="gallery-trigger"
            onClick={() => setActiveIndex(index)}
            aria-label={`Open gallery image ${index + 1}`}
          >
            <figure className="gallery-item watermark-surface">
              <Image
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                className="gallery-image"
                loading="lazy"
                decoding="async"
                sizes="(max-width: 760px) 100vw, (max-width: 1100px) 33vw, 300px"
              />
              <span className="gallery-tap-chip">Tap to view</span>
            </figure>
          </button>
        ))}
      </div>

      {isOpen && activeItem ? (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" onClick={closeLightbox}>
          <button
            type="button"
            className="gallery-lightbox-close"
            onClick={closeLightbox}
            aria-label="Close gallery"
          >
            X
          </button>

          <button
            type="button"
            className="gallery-lightbox-nav gallery-lightbox-prev"
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
            aria-label="Previous image"
          >
            {"<"}
          </button>

          <div className="gallery-lightbox-frame" onClick={(event) => event.stopPropagation()}>
            <div
              className="gallery-lightbox-gesture-zone"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchCancel}
            >
              <Image
                src={activeItem.src}
                alt={activeItem.alt}
                width={activeItem.width}
                height={activeItem.height}
                className="gallery-lightbox-image"
                sizes="(max-width: 760px) 100vw, 92vw"
                priority
              />
            </div>
            <p className="gallery-lightbox-caption">
              <span>
                Photo {activeIndex + 1} of {itemCount}
              </span>
            </p>
          </div>

          <button
            type="button"
            className="gallery-lightbox-nav gallery-lightbox-next"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            aria-label="Next image"
          >
            {">"}
          </button>
        </div>
      ) : null}
    </>
  );
}
