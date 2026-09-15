---
layout: layouts/page
title: Contents
---
<link rel="stylesheet" href="{{ '/assets/css/ordered-list.css' | url }}">

{%- macro listPage(page) -%}
{%- if page.meta.title -%}
    <li>
        <a href={{page.output}}>{{ page.meta.title | safe }}</a>
        <p>{{ page.meta.tags or "no tags" }}</p>
        {%- if page.sections.length > 0 -%}
        <ul>
        {%- for subPage in page.sections -%}
        {{ listPage(subPage) }}
        {%- endfor -%}
        </ul>
        {%- endif -%}
    </li>
{%- endif -%}
{%- endmacro -%}

<ul>
{%- for page in contents.sections -%}
{{ listPage(page) }}
{%- endfor -%}
</ul>