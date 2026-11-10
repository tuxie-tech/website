---
layout: layouts/catalog
title: Catalog
tags:
    - catalog
---

<x-box>
    We're still working on consolidating our catalog, so things look a little sparse around here right now. If there's something we haven't got to yet, that you would be interested in, please <a href="mailto:john@tuxie.tech?subject=TuxieTech%20Enquiries">contact John at via email</a>
</x-box>

{% from "components/catalog-tile.njk" import render as catalogTile %}

## Our Hardware

<div class="flex flex-wrap gap-5 justify-center items-stretch mx-auto w-full px-5">
{%- for entry in collections.hardwareIndex -%}
    {{ catalogTile(entry) }}
{%- endfor %}
</div>

## Our Software

<div class="flex flex-wrap gap-5 justify-center items-stretch mx-auto w-full px-5">
{%- for entry in collections.softwareIndex -%}
    {{ catalogTile(entry) }}
{%- endfor %}
</div>

<script type="module">
    const apiBaseUrl = "{{ apiBaseUrl | escape }}".replace( /\/+$/, "" );
    const formatCurrency = new Intl.NumberFormat( "en-GB", { style: "currency", currency: "GBP" } );
    const tiles = [...document.querySelectorAll( "[data-tile-price]" )];
    const ids = [...new Set( tiles.map( tile => tile.dataset.tilePrice ) )];
    if ( ids.length > 0 ) {
        try {
            const response = await fetch( `${apiBaseUrl}/catalog/prices?ids=${ids.map( encodeURIComponent ).join( "," )}` );
            if ( !response.ok ) {
                throw new Error( `Catalog API returned ${response.status}` );
            }
            const { prices } = await response.json();
            tiles.forEach( tile => {
                const price = prices[tile.dataset.tilePrice];
                if ( !price ) {
                    return;
                }
                tile.textContent = `From ${formatCurrency.format( price.min )}`;
                tile.hidden = false;
            } );
        } catch ( error ) {
            console.error( "Unable to load prices", error );
        }
    }
</script>
