---
layout: layouts/catalog-page
title: The Boards Catalog
---
{%- import "components/tile.njk" as tile -%}

<div class="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-5 justify-center items-stretch">
{% for entry in collections.catalog %}
{{ tile.clickable(entry.data.title, hero=entry.url + "/" + entry.data.hero, url=entry.url ) }}
{% endfor %}
</div>

## Collections

<pre>
{%- for name, items in collections -%}
{{ name }}: {{ items | length }}<br />
{%- endfor -%}
</pre>