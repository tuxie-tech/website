---
layout: layouts/catalog-page
title: The Documentation Catalog
tags:
    - catalog
---
{%- import "components/tile.njk" as tile -%}

<div class="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-5 justify-center items-stretch">
{%- for entry in collections.catalogIndex %}
    {%- if entry.url %}
        {% set hero = entry.data.hero[0] if entry.data.hero is not string else entry.data.hero %}
        {{ tile.clickable(entry.data.title, hero=entry.url + hero, url=entry.url ) }}
    {%- endif %}
{%- endfor %}
</div>