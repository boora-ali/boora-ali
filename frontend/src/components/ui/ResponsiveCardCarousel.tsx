import { type ReactNode, useEffect, useState } from "react";
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

type ResponsiveCardCarouselProps<T> = {
  ariaLabel: string;
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  desktopPageSize: number;
  mobilePageSize: number;
  desktopColumns?: number;
  mobileColumns?: number;
};

const DESKTOP_QUERY = "(min-width: 768px)";

function getIsDesktop() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export function ResponsiveCardCarousel<T>({
  ariaLabel,
  items,
  getKey,
  renderItem,
  desktopPageSize,
  mobilePageSize,
  desktopColumns,
  mobileColumns = 2,
}: ResponsiveCardCarouselProps<T>) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [isDesktop, setIsDesktop] = useState(getIsDesktop);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const pageSize = isDesktop ? desktopPageSize : mobilePageSize;
  const columns = isDesktop ? (desktopColumns ?? Math.min(desktopPageSize, 4)) : mobileColumns;
  const pages = chunkItems(items, pageSize);

  useEffect(() => {
    if (!api) {
      return;
    }

    const update = () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
    };

    update();
    api.on("select", update);
    api.on("reInit", update);

    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  useEffect(() => {
    api?.scrollTo(0);
  }, [api, items.length, pageSize]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Carousel
        aria-label={ariaLabel}
        className="w-full"
        opts={{ align: "start", dragFree: false }}
        setApi={setApi}
      >
        <CarouselContent>
          {pages.map((pageItems, pageIndex) => (
            <CarouselItem key={pageIndex}>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {pageItems.map((item, itemIndex) => {
                  const absoluteIndex = pageIndex * pageSize + itemIndex;

                  return (
                    <div key={getKey(item, absoluteIndex)} className="min-w-0">
                      {renderItem(item, absoluteIndex)}
                    </div>
                  );
                })}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {count > 1 && (
        <div className="flex items-center justify-center gap-2" aria-label={`${ariaLabel} pagination`}>
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={current === index ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
              className={`h-2.5 rounded-full transition-all ${
                current === index
                  ? "w-7 bg-primary"
                  : "w-2.5 bg-muted/40 hover:bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
