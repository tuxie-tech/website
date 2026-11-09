import { normalizeQuantity, readCart, removeItem, setQuantity } from "./cart-session.js";

const COST_DEBOUNCE_MS = 1000;
const CURRENCY_FORMAT = new Intl.NumberFormat( "en-GB", {
    style: "currency",
    currency: "GBP"
} );

function formatCost( amountMinor ) {
    return CURRENCY_FORMAT.format( amountMinor / 100 );
}

function getStockLimit( variant ) {
    if ( variant?.availableStock === null || variant?.availableStock === undefined ) {
        return null;
    }

    return normalizeQuantity( variant.availableStock, variant.availableStock );
}

async function fetchVariants( apiBaseUrl, productId ) {
    const response = await fetch(
        `${apiBaseUrl}/catalog/items/${encodeURIComponent( productId )}`
    );
    if ( !response.ok ) {
        throw new Error( `Catalog API returned ${response.status}` );
    }

    const payload = await response.json();
    return {
        productName: payload.productName || "Unnamed item",
        variants: Array.isArray( payload.variants ) ? payload.variants : []
    };
}

function showEmpty( status, content, message = "Your cart is empty." ) {
    content.hidden = true;
    status.hidden = false;
    status.textContent = message;
}

async function renderCart( cart ) {
    const status = cart.querySelector( "[data-cart-status]" );
    const stockHelp = cart.querySelector( "[data-stock-help]" );
    const content = cart.querySelector( "[data-cart-content]" );
    const rows = cart.querySelector( "[data-cart-rows]" );
    const template = document.querySelector( "[data-cart-row-template]" );
    const groupTemplate = document.querySelector( "[data-cart-product-group-template]" );
    const productPages = new Map(
        [...document.querySelectorAll( "[data-catalog-product-link]" )].map( link =>
            [link.dataset.productId, link.href]
        )
    );
    const subtotal = cart.querySelector( "[data-cart-subtotal]" );
    const checkoutButton = cart.querySelector( "[data-checkout]" );
    const apiBaseUrl = cart.dataset.apiBaseUrl.replace( /\/+$/, "" );
    const items = readCart();

    checkoutButton.addEventListener( "click", async () => {
        checkoutButton.disabled = true;
        checkoutButton.textContent = "Opening Square checkout...";

        try {
            const response = await fetch( `${apiBaseUrl}/checkout`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ items: readCart() })
            } );
            const result = await response.json();

            if ( response.status === 409 ) {
                status.hidden = false;
                status.textContent = result.error || "Stock changed. Updating your cart.";
                window.location.reload();
                return;
            }

            if ( !response.ok ) {
                throw new Error( result.error || `Checkout failed (${response.status}).` );
            }

            if ( typeof result.url !== "string" || !result.url.startsWith( "https://" ) ) {
                throw new Error( "Square did not return a valid checkout URL." );
            }

            window.location.assign( result.url );
        } catch ( error ) {
            console.error( "Unable to start Square checkout.", error );
            status.hidden = false;
            status.textContent = error.message || "Checkout could not be started. Try again.";
            checkoutButton.disabled = false;
            checkoutButton.textContent = "Checkout";
        }
    } );

    if ( items.length === 0 ) {
        showEmpty( status, content );
        return;
    }

    const productIds = [...new Set( items.map( item => item.productId ) )];
    const productResults = await Promise.all( productIds.map( async productId => {
        try {
            return [productId, await fetchVariants( apiBaseUrl, productId )];
        } catch ( error ) {
            console.error( `Unable to load product ${productId}.`, error );
            return [productId, null];
        }
    } ) );
    const productsById = new Map( productResults );
    let hasUnavailableItems = false;
    let removedOutOfStockItems = false;
    let removedUnavailableItems = false;
    let adjustedQuantities = false;
    const itemsByProduct = new Map();
    const updateStockHelp = () => {
        const hasMaxedRows = [...rows.querySelectorAll( "[data-cart-row]" )].some(( row ) => {
            if ( row.dataset.availableStock === "" ) {
                return false;
            }

            const stockLimit = Number( row.dataset.availableStock );
            const quantity = Number( row.querySelector( ".quantity-pill__input" ).value );
            return stockLimit === 0 || quantity >= stockLimit;
        } );

        stockHelp.hidden = !( removedOutOfStockItems || removedUnavailableItems || hasMaxedRows );
    };

    items.forEach(( item ) => {
        const product = productsById.get( item.productId );
        const variant = product?.variants?.find( candidate => candidate.id === item.variantId );
        const stockLimit = getStockLimit( variant );

        if ( product && !variant ) {
            removeItem( item.productId, item.variantId );
            removedUnavailableItems = true;
            return;
        }

        if ( stockLimit === 0 ) {
            removeItem( item.productId, item.variantId );
            removedOutOfStockItems = true;
            return;
        }

        const quantity = normalizeQuantity( item.quantity, stockLimit );
        if ( quantity === 0 ) {
            removeItem( item.productId, item.variantId );
            removedOutOfStockItems = true;
            return;
        }

        if ( quantity !== item.quantity ) {
            setQuantity( item.productId, item.variantId, quantity );
            adjustedQuantities = true;
        }

        if ( !itemsByProduct.has( item.productId ) ) {
            itemsByProduct.set( item.productId, { product: product, items: [] } );
        }

        itemsByProduct.get( item.productId ).items.push({
            ...item,
            quantity: quantity,
            variant: variant,
            stockLimit: stockLimit
        });
    } );

    if ( itemsByProduct.size === 0 ) {
        const message = removedOutOfStockItems || removedUnavailableItems
            ? "Unavailable items were removed. Your cart is empty."
            : "Your cart is empty.";
        updateStockHelp();
        showEmpty( status, content, message );
        return;
    }

    itemsByProduct.forEach(( productCart, productId ) => {
        const { product: product, items: productItems } = productCart;
        const productVariants = product?.variants;
        const productGroup = groupTemplate.content.firstElementChild.cloneNode( true );
        productGroup.dataset.productId = productId;
        const productHeading = productGroup.querySelector( "[data-cart-product-name]" );
        const productName = product?.productName || "Product unavailable";
        const productUrl = productPages.get( productId );
        if ( productUrl ) {
            const productLink = document.createElement( "a" );
            productLink.href = productUrl;
            productLink.className = "underline decoration-2 underline-offset-4 hover:decoration-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0066CC]";
            productLink.textContent = productName;
            productHeading.replaceChildren( productLink );
        } else {
            productHeading.textContent = productName;
        }
        rows.append( productGroup );

        productItems.forEach(( item ) => {
        const variant = item.variant;
        const unitCost = Number( variant?.unitCost );
        const hasPrice = variant?.unitCost !== null
            && variant?.unitCost !== undefined
            && Number.isFinite( unitCost )
            && unitCost >= 0;
        const unitPriceMinor = hasPrice ? Math.round( unitCost * 100 ) : null;
        const row = template.content.firstElementChild.cloneNode( true );
        const name = variant?.name || ( product === null ? "Product unavailable" : "Variant unavailable" );
        const input = row.querySelector( ".quantity-pill__input" );
        const incrementButton = row.querySelector( '[data-quantity-step="1"]' );

        row.dataset.productId = item.productId;
        row.dataset.variantId = item.variantId;
        row.dataset.unitPriceMinor = hasPrice ? String( unitPriceMinor ) : "";
        row.dataset.availableStock = item.stockLimit === null ? "" : String( item.stockLimit );
        row.querySelector( "[data-cart-name]" ).textContent = name;
        row.querySelector( "[data-cart-unit-cost]" ).textContent = hasPrice
            ? formatCost( unitPriceMinor )
            : "Unavailable";
        row.querySelector( "[data-cart-line-total]" ).textContent = hasPrice
            ? formatCost( unitPriceMinor * item.quantity )
            : "Unavailable";
        const stockLabel = row.querySelector( "[data-cart-stock]" );
        if ( item.stockLimit !== null ) {
            stockLabel.textContent = `Available: ${item.stockLimit}`;
        } else {
            stockLabel.hidden = true;
        }
        input.value = String( item.quantity );
        input.dataset.stockLimit = item.stockLimit === null ? "" : String( item.stockLimit );
        input.setAttribute( "aria-label", `${name} quantity` );
        row.querySelector( ".quantity-pill" ).setAttribute( "aria-label", `Choose ${name} quantity` );
        row.querySelector( '[data-quantity-step="-1"]' ).setAttribute( "aria-label", `Decrease ${name} quantity` );
        row.querySelector( '[data-quantity-step="1"]' ).setAttribute( "aria-label", `Increase ${name} quantity` );
        row.querySelector( "[data-remove-item]" ).setAttribute( "aria-label", `Remove ${name} from cart` );

        if ( !hasPrice ) {
            hasUnavailableItems = true;
            input.disabled = true;
            row.querySelectorAll( "[data-quantity-step]" ).forEach( button => {
                button.disabled = true;
            } );
        }

        incrementButton.disabled = !hasPrice ||
            ( item.stockLimit !== null && item.quantity >= item.stockLimit );

        productGroup.append( row );
        } );
    } );

    const scheduleTotals = () => {
        clearTimeout( cart.costTimeout );
        subtotal.setAttribute( "aria-busy", "true" );
        rows.querySelectorAll( "[data-cart-line-total]" ).forEach( total => {
            total.setAttribute( "aria-busy", "true" );
        } );
        cart.costTimeout = setTimeout( updateTotals, COST_DEBOUNCE_MS );
    };

    function updateTotals() {
        let subtotalMinor = 0;

        rows.querySelectorAll( "[data-cart-row]" ).forEach(( row ) => {
            const price = Number( row.dataset.unitPriceMinor );
            const quantity = Number( row.querySelector( ".quantity-pill__input" ).value );
            const lineTotal = row.querySelector( "[data-cart-line-total]" );

            if ( row.dataset.unitPriceMinor !== "" && Number.isFinite( price ) && Number.isFinite( quantity ) ) {
                const lineTotalMinor = price * quantity;
                subtotalMinor += lineTotalMinor;
                lineTotal.textContent = formatCost( lineTotalMinor );
                lineTotal.removeAttribute( "aria-busy" );
            } else {
                lineTotal.removeAttribute( "aria-busy" );
            }
        } );

        subtotal.textContent = rows.querySelector( '[data-unit-price-minor=""]' )
            ? "Unavailable"
            : formatCost( subtotalMinor );
        subtotal.removeAttribute( "aria-busy" );
    }

    rows.querySelectorAll( "[data-cart-row]" ).forEach(( row ) => {
        const productId = row.dataset.productId;
        const variantId = row.dataset.variantId;
        const input = row.querySelector( ".quantity-pill__input" );
        const stockLimit = input.dataset.stockLimit === "" ? null : Number( input.dataset.stockLimit );
        const incrementButton = row.querySelector( '[data-quantity-step="1"]' );

        const changeQuantity = ( removeAtZero = false ) => {
            if ( input.value === "" && !removeAtZero ) {
                return;
            }

            const quantity = normalizeQuantity( input.value, stockLimit );

            input.value = String( quantity );
            setQuantity( productId, variantId, quantity );
            incrementButton.disabled = input.disabled ||
                ( stockLimit !== null && quantity >= stockLimit );
            updateStockHelp();

            if ( quantity === 0 && removeAtZero ) {
                const productGroup = row.parentElement;
                if ( productGroup.querySelectorAll( "[data-cart-row]" ).length === 1 ) {
                    productGroup.remove();
                } else {
                    row.remove();
                }

                if ( rows.querySelectorAll( "[data-cart-row]" ).length === 0 ) {
                    showEmpty( status, content );
                } else if ( !rows.querySelector( '[data-unit-price-minor=""]' ) ) {
                    status.hidden = true;
                }
            }

            scheduleTotals();
        };

        input.addEventListener( "input", () => changeQuantity() );
        input.addEventListener( "change", () => changeQuantity( true ) );
        row.querySelectorAll( "[data-quantity-step]" ).forEach(( button ) => {
            button.addEventListener( "click", () => {
                input.value = String( Number( input.value ) + Number( button.dataset.quantityStep ) );
                changeQuantity( true );
            } );
        } );
        row.querySelector( "[data-remove-item]" ).addEventListener( "click", () => {
            removeItem( productId, variantId );
            const productGroup = row.parentElement;
            if ( productGroup.querySelectorAll( "[data-cart-row]" ).length === 1 ) {
                productGroup.remove();
            } else {
                row.remove();
            }

            if ( rows.querySelectorAll( "[data-cart-row]" ).length === 0 ) {
                showEmpty( status, content );
            } else if ( !rows.querySelector( '[data-unit-price-minor=""]' ) ) {
                status.hidden = true;
            }
            updateStockHelp();
            scheduleTotals();
        } );
    } );

    const notices = [];
    if ( removedOutOfStockItems ) {
        notices.push( "Out-of-stock items were removed from your cart." );
    }
    if ( removedUnavailableItems ) {
        notices.push( "Items no longer available were removed from your cart." );
    }
    if ( adjustedQuantities ) {
        notices.push( "Some quantities were reduced to match available stock." );
    }
    if ( hasUnavailableItems ) {
        notices.push( "Some item prices could not be loaded." );
    }
    status.hidden = notices.length === 0;
    status.textContent = notices.join( " " );
    content.hidden = false;
    updateStockHelp();
    updateTotals();
}

document.querySelectorAll( "[data-shopping-cart]" ).forEach( cart => {
    renderCart( cart ).catch( error => {
        console.error( "Unable to load the shopping cart.", error );
        const status = cart.querySelector( "[data-cart-status]" );
        status.hidden = false;
        status.textContent = "Your cart could not be loaded. Refresh the page to try again.";
    } );
} );