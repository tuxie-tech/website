---
layout: layouts/catalog-page
title: Software
tags:
    - catalog
---

<x-box>
    We're still working on consolidating our catalog, so things look a little sparse around here right now. If there's something we haven't got to yet, that you would be interested in, please <a href="mailto:j.vidler@lancaster.ac.uk?subject=TuxieTech%20Enquiries">contact John at via email</a>
</x-box>

<div class="flex flex-wrap gap-5 justify-center items-stretch mx-auto w-full px-5">
{%- for entry in collections.softwareIndex %}
    {%- if entry.url %}
        {%- set hero = entry.data.hero[0] if entry.data.hero is not string else entry.data.hero -%}
        {%- set secondaryHero = entry.data.hero[1] if entry.data.hero is not string and entry.data.hero.length > 1 else '' -%}
        {%- set info = entry.data.info -%}
        {%- if true -%}
        <a href="{{ entry.url }}" class="noline group block w-full max-w-80">
            <x-tile>
                <div class="relative w-full">
                    <img src="{{ entry.url + hero }}" class="mb-2 p-5" loading="lazy" />
                    {%- if secondaryHero -%}
                    <img src="{{ entry.url + secondaryHero }}" class="absolute inset-0 mb-2 p-5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" loading="lazy" />
                    {%- endif -%}
                </div>
                <h3 class="text-xl font-semibold mb-2 text-center">{{ entry.data.title }}</h3>
                <p class="text-center">{{ entry.data.info }}</p>
            </x-tile>
        </a>
        {%- endif -%}
    {%- endif %}
{%- endfor %}
</div>
