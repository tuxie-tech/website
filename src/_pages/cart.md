---
layout: layouts/catalog
title: Shopping Cart
tags:
    - catalog
    - cart
    - shopping
    - purchase
---

<section class="shopping-cart" data-shopping-cart data-api-base-url="{{ apiBaseUrl | escape }}">
    <p class="shopping-cart__status" data-cart-status role="status" aria-live="polite">Loading your cart...</p>
    <div class="shopping-cart__stock-help" data-stock-help role="status" aria-live="polite" hidden>
        Some items are sold out or at their stock limit. For stock or purchase questions, <a href="mailto:john@tuxie.tech?subject=TuxieTech%20Cart%20Stock%20Enquiry">contact us</a>.
    </div>
    <div class="shopping-cart__content" data-cart-content hidden>
        <div class="shopping-cart__table-wrap">
            <table class="shopping-cart__table" data-cart-rows>
                <thead>
                    <tr>
                        <th scope="col">Item</th>
                        <th scope="col">Unit cost</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Line total</th>
                        <th scope="col"><span class="visually-hidden">Actions</span></th>
                    </tr>
                </thead>
            </table>
        </div>
        <div class="shopping-cart__summary" aria-live="polite" aria-atomic="true">
            <span>Subtotal</span>
            <strong data-cart-subtotal>£0.00</strong>
        </div>
        <div class="flex justify-end py-4">
            <button class="rounded-full bg-(--primary) px-6 py-3 font-bold text-(--dark) hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-60" type="button" data-checkout>Checkout</button>
        </div>
    </div>
    <a class="shopping-cart__continue" href="{{ '/catalog/' | url }}">Continue shopping</a>
</section>

<div hidden data-catalog-product-pages>
    {% for productPage in collections.catalog %}
        {% if productPage.data.squareId and productPage.inputPath.endsWith("/index.md") %}
            <a data-catalog-product-link data-product-id="{{ productPage.data.squareId | escape }}" href="{{ productPage.url | url }}">{{ productPage.data.title | escape }}</a>
        {% endif %}
    {% endfor %}
</div>

<template data-cart-row-template>
    <tr data-cart-row>
        <th scope="row" data-cart-name style="padding-left: 3rem;"></th>
        <td data-cart-unit-cost></td>
        <td>
            <div class="flex flex-col items-center gap-1">
                <div class="quantity-pill inline-flex h-6 items-center overflow-hidden rounded-full border border-(--gray) bg-(--white)" role="group">
                    <button class="quantity-pill__button grid size-6 cursor-pointer place-items-center bg-(--primary) text-2xl leading-none font-bold text-(--dark) hover:enabled:bg-(--accent) disabled:cursor-not-allowed disabled:text-[#666] focus-visible:relative focus-visible:z-1 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-(--link)" type="button" data-quantity-step="-1"><span class="inline-block -translate-y-0.5 leading-none" aria-hidden="true">-</span></button>
                    <input class="quantity-pill__input h-6 w-16 border-0 bg-transparent p-0 text-center font-bold tabular-nums text-(--text-default) focus-visible:relative focus-visible:z-1 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-(--link)" type="text" inputmode="numeric" pattern="[0-9]*">
                    <button class="quantity-pill__button grid size-6 cursor-pointer place-items-center bg-(--primary) text-2xl leading-none font-bold text-(--dark) hover:enabled:bg-(--accent) disabled:cursor-not-allowed disabled:text-[#666] focus-visible:relative focus-visible:z-1 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-(--link)" type="button" data-quantity-step="1"><span class="inline-block -translate-y-0.5 leading-none" aria-hidden="true">+</span></button>
                </div>
                <div class="text-xs tabular-nums text-gray-600" data-cart-stock></div>
            </div>
        </td>
        <td data-cart-line-total></td>
        <td><button class="shopping-cart__remove" type="button" data-remove-item>Remove</button></td>
    </tr>
</template>

<template data-cart-product-group-template>
    <tbody data-cart-product-group>
        <tr class="shopping-cart__product-heading">
            <th scope="rowgroup" colspan="5" data-cart-product-name></th>
        </tr>
    </tbody>
</template>

<script type="module" src="{{ '/assets/js/shopping-cart.js' | url }}"></script>