---
layout: layouts/page
title: Guides
---

Short, step-by-step guides for the things that come up across many of our products. If you get stuck on something that isn't covered here, please <a href="mailto:john@tuxie.tech?subject=TuxieTech%20Guides">get in touch</a> and we'll add it.

{% from "components/guide-tile.njk" import render as guideTile %}

<div class="flex flex-wrap gap-5 justify-center items-stretch mx-auto w-full px-5">
{%- for guide in collections.guides -%}
    {{ guideTile(guide) }}
{%- endfor %}
</div>
