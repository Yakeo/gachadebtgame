import type { CSSProperties } from "react";

/**
 * Layout for the recruit banner's two art layers.
 *
 * These are inline styles rather than class rules on purpose, and the reason is
 * a specific failure this page has already had twice.
 *
 * The banner art is decoration, but it is large - the illustrations are around
 * 572x1024. While the art was positioned by stylesheet rules alone, a rule that
 * stopped matching (a malformed selector, or a stale element-qualified rule
 * losing the cascade) dropped the images back into normal flow. They then took
 * up their full size as block content and pushed the copy, the pity bar and
 * both recruit buttons off the screen: the page rendered as art with no text
 * and nothing to click.
 *
 * An inline style cannot be outranked by a class, so the worst a stylesheet
 * regression can do now is make the art look wrong. It cannot break the page.
 *
 * Everything here is only what is needed to keep the art out of the layout and
 * behind the content. The look - the blur, the tint, the entrance animation -
 * stays in the stylesheet where it can be tuned freely, because a cosmetic slip
 * there is survivable and this is not.
 */

/** The blurred full-bleed wash behind the figure. */
export const RECRUIT_ART_WASH: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: -4,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "62% 16%",
  pointerEvents: "none",
};

/**
 * The figure itself, anchored right. `height: 100%` with `width: auto` and
 * `maxWidth` keeps it at its own aspect ratio instead of stretching it across
 * the banner, which is what made it look soft.
 */
export const RECRUIT_ART_FIGURE: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  height: "100%",
  width: "auto",
  maxWidth: "70%",
  objectFit: "contain",
  objectPosition: "right center",
  zIndex: -3,
  pointerEvents: "none",
};

/** Anything at or above this sits in front of both art layers. */
export const RECRUIT_CONTENT_Z = 2;
