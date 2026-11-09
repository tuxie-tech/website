export const CART_STORAGE_KEY = "tuxietech.cart";

export function normalizeQuantity( quantity, availableStock = null ) {
    const normalizedQuantity = Math.floor( Number( quantity ) );
    if ( !Number.isSafeInteger( normalizedQuantity ) || normalizedQuantity < 0 ) {
        return 0;
    }

    if ( availableStock === null || availableStock === undefined ) {
        return normalizedQuantity;
    }

    const stockLimit = Math.floor( Number( availableStock ) );
    if ( !Number.isSafeInteger( stockLimit ) || stockLimit < 0 ) {
        return 0;
    }

    return Math.min( normalizedQuantity, stockLimit );
}

function normalizeItem( item ) {
    if (
        typeof item?.productId !== "string" ||
        !item.productId ||
        typeof item.variantId !== "string" ||
        !item.variantId
    ) {
        return null;
    }

    const quantity = Math.floor( Number( item.quantity ) );
    if ( !Number.isSafeInteger( quantity ) || quantity < 1 ) {
        return null;
    }

    return {
        productId: item.productId,
        variantId: item.variantId,
        quantity: quantity
    };
}

export function readCart( storage = globalThis.sessionStorage ) {
    try {
        const items = JSON.parse( storage.getItem( CART_STORAGE_KEY ) || "[]" );
        if ( !Array.isArray( items ) ) {
            storage.setItem( CART_STORAGE_KEY, "[]" );
            return [];
        }

        const normalizedItems = items.map( normalizeItem ).filter( Boolean );
        if ( JSON.stringify( normalizedItems ) !== JSON.stringify( items ) ) {
            storage.setItem( CART_STORAGE_KEY, JSON.stringify( normalizedItems ) );
        }

        return normalizedItems;
    } catch {
        return [];
    }
}

export function saveCart( items, storage = globalThis.sessionStorage ) {
    const normalizedItems = items.map( normalizeItem ).filter( Boolean );
    storage.setItem( CART_STORAGE_KEY, JSON.stringify( normalizedItems ) );
    return normalizedItems;
}

export function setQuantity( productId, variantId, quantity, storage = globalThis.sessionStorage ) {
    const normalizedQuantity = Math.floor( Number( quantity ) );
    const items = readCart( storage ).filter( item =>
        item.productId !== productId || item.variantId !== variantId
    );

    if ( Number.isSafeInteger( normalizedQuantity ) && normalizedQuantity > 0 ) {
        items.push({
            productId: productId,
            variantId: variantId,
            quantity: normalizedQuantity
        });
    }

    return saveCart( items, storage );
}

export function getQuantity( productId, variantId, storage = globalThis.sessionStorage ) {
    return readCart( storage ).find( item =>
        item.productId === productId && item.variantId === variantId
    )?.quantity || 0;
}

export function removeItem( productId, variantId, storage = globalThis.sessionStorage ) {
    const items = readCart( storage ).filter( item =>
        item.productId !== productId || item.variantId !== variantId
    );

    return saveCart( items, storage );
}