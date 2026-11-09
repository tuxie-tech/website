import assert from "node:assert/strict";
import test from "node:test";
import { CART_STORAGE_KEY, getQuantity, normalizeQuantity, readCart, removeItem, saveCart, setQuantity } from "../src/assets/js/cart-session.js";

test( "stores only product ID, variant ID, and quantity", () => {
    const storage = {
        values: new Map(),
        setItem( key, value ) {
            this.values.set( key, value );
        }
    };

    saveCart( [{
        productId: "product-1",
        variantId: "variant-1",
        quantity: 2,
        name: "Build A",
        unitCost: 2.5
    }], storage );

    assert.deepEqual( JSON.parse( storage.values.get( CART_STORAGE_KEY ) ), [{
        productId: "product-1",
        variantId: "variant-1",
        quantity: 2
    }] );
} );

test( "quantity updates upsert an item and zero removes it", () => {
    const storage = {
        values: new Map(),
        getItem( key ) {
            return this.values.get( key ) ?? null;
        },
        setItem( key, value ) {
            this.values.set( key, value );
        }
    };

    setQuantity( "product-1", "variant-1", 3, storage );
    assert.equal( getQuantity( "product-1", "variant-1", storage ), 3 );

    setQuantity( "product-1", "variant-1", 0, storage );
    assert.deepEqual( readCart( storage ), [] );

    setQuantity( "product-1", "variant-1", 2, storage );
    removeItem( "product-1", "variant-1", storage );
    assert.deepEqual( readCart( storage ), [] );
} );

test( "strips display and price data from existing session records", () => {
    const storage = {
        values: new Map([[CART_STORAGE_KEY, JSON.stringify([{
            productId: "product-1",
            variantId: "variant-1",
            quantity: 2,
            name: "Build A",
            unitCost: 2.5
        }])]]),
        getItem( key ) {
            return this.values.get( key ) ?? null;
        },
        setItem( key, value ) {
            this.values.set( key, value );
        }
    };

    readCart( storage );

    assert.deepEqual( JSON.parse( storage.values.get( CART_STORAGE_KEY ) ), [{
        productId: "product-1",
        variantId: "variant-1",
        quantity: 2
    }] );
} );

test( "clamps quantities to available stock while allowing untracked stock", () => {
    assert.equal( normalizeQuantity( 8, 3 ), 3 );
    assert.equal( normalizeQuantity( 4, 0 ), 0 );
    assert.equal( normalizeQuantity( -1, 5 ), 0 );
    assert.equal( normalizeQuantity( 8, null ), 8 );
} );