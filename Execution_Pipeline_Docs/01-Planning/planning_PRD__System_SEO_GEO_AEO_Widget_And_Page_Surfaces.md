# Planning PRD - System SEO/GEO/AEO for Widget and Page Surfaces

Status: Draft
Owner: Product + Architecture
Date: 2026-06-24

## What This PRD Is About

This PRD defines Clickeen's system approach to SEO, GEO, and AEO for the
actual surfaces Clickeen serves:

- widget instances;
- pages composed of widget instances.

There is no separate page-block product layer in the account authoring path.
SEO/GEO/AEO work attaches to the real served artifact: either one widget
instance, or one page made from a stack of widget instances.

## Product Law

Clickeen serves content. Search engines, geographic markets, and answer engines
consume served content, not internal planning abstractions.

Therefore:

- widget-level SEO/GEO/AEO operates on a widget instance;
- page-level SEO/GEO/AEO operates on a page made from widget instances;
- no block layer is introduced;
- no duplicate content model is introduced;
- no visitor request calls an agent or model;
- public serving uses generated artifacts only.

## Widget-Level SEO/GEO/AEO

A widget instance is a crawlable content surface when it is served publicly.

Widget-level SEO/GEO/AEO means the widget output can include:

- localized visible content from the active locale artifacts;
- widget-owned structured data when the widget type supports it;
- answer-ready copy for questions, reviews, product/service facts, or other
  widget-owned content;
- locale-correct metadata needed by the public runtime.

Examples:

- an FAQ widget can emit FAQ content and FAQ structured data;
- a reviews widget can emit review and aggregate-rating structured data;
- a product/service widget can emit product or service facts;
- a translated widget can expose the same source truth in each active locale.

The widget owns its own content meaning. The system must not create a second
SEO content tree beside the widget.

## Page-Level SEO/GEO/AEO

A page is a stack of widget instances.

Page-level SEO/GEO/AEO means the system evaluates and improves the page as an
assembled served artifact:

- page title;
- page description;
- canonical URL;
- locale URLs and hreflang;
- page-level structured data;
- heading order across the widget stack;
- internal links;
- market and geographic intent;
- answer-engine readiness across the combined page content;
- whether the page answers the intended query or market need.

The page does not own a separate block content model. It composes widget
instances and adds page-level serving metadata around them.

## Serving Rule

Public serving must remain generated-artifact serving.

Normal visitor or crawler requests must not:

- fetch authoring JSON;
- fetch overlay JSON directly;
- call Bob or Roma account APIs;
- call San Francisco;
- call the Translation Agent;
- call the SEO/GEO/AEO Agent.

The serving runtime serves the generated widget or page artifact it finds.

## Agent Role

The future SEO/GEO/AEO Agent is not the serving path.

It is an async operator that can measure crawlable widget and page surfaces,
identify improvements, and propose changes through the product's governed
content paths.

The agent may eventually:

- inspect indexed widget and page surfaces;
- measure search, geographic, and answer-engine performance;
- identify weak metadata, schema, headings, snippets, and answer gaps;
- recommend locale-specific improvements;
- feed approved improvements back into widget content, page metadata, or
  Translation Agent work.

The agent must not silently rewrite live customer-visible content from cron
output.

## Draft Scope To Continue

This draft still needs decisions on:

- exact generated artifact shapes for widget SEO/GEO/AEO;
- exact generated artifact shapes for page SEO/GEO/AEO;
- which widget types emit which structured data;
- how page-level metadata is authored, generated, and updated;
- where SEO/GEO/AEO recommendations are stored;
- how approved recommendations are applied;
- how clk.live exposes locale-specific widget and page URLs.
