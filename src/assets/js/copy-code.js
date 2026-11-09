// Makes the copy buttons rendered by eleventy-plugins/copy-button.js work. A button copies the
// code in the `pre` before it, or in the `code` before it when it sits in a `.copy-inline`.
( function () {
    document.documentElement.classList.add( "can-copy" );

    async function copyText( text ) {
        try {
            await navigator.clipboard.writeText( text );
            return true;
        } catch ( e ) {
            // Fall back for insecure contexts, where the async clipboard API is unavailable
            const area = document.createElement( "textarea" );
            area.value = text;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.append( area );
            area.select();
            let ok = false;
            try { ok = document.execCommand( "copy" ); } catch ( e2 ) {}
            area.remove();
            return ok;
        }
    }

    const LABEL = "Copy code to clipboard";
    const TOOLTIP = "Copy to clipboard";
    const timers = new WeakMap();

    // A short-lived message above the button, announced to screen readers as a status update.
    function toast( button, message, failed ) {
        let element = button.nextElementSibling;
        if ( !element || !element.classList.contains( "copy-toast" ) ) {
            element = document.createElement( "span" );
            element.className = "copy-toast";
            element.setAttribute( "role", "status" );
            button.after( element );
        }

        element.dataset.failed = failed ? "true" : "false";
        element.textContent = message;
        element.classList.remove( "is-visible" );
        void element.offsetWidth; // restart the animation if clicked again while showing
        element.classList.add( "is-visible" );
    }

    document.addEventListener( "click", async function ( event ) {
        const button = event.target.closest && event.target.closest( ".copy-button" );
        if ( !button ) return;

        const source = button.previousElementSibling;
        if ( !source ) return;

        const text = ( source.querySelector( "code" ) || source ).textContent.replace( /\n$/, "" );
        const ok = await copyText( text );

        button.dataset.state = ok ? "done" : "failed";
        button.setAttribute( "aria-label", ok ? "Copied" : "Copy failed" );
        button.title = ok ? "Copied" : "Copy failed";
        toast( button, ok ? "Copied" : "Copy failed", !ok );

        clearTimeout( timers.get( button ) );
        timers.set( button, setTimeout( function () {
            delete button.dataset.state;
            button.setAttribute( "aria-label", LABEL );
            button.title = TOOLTIP;
            const shown = button.nextElementSibling;
            if ( shown && shown.classList.contains( "copy-toast" ) ) shown.classList.remove( "is-visible" );
        }, 1800 ) );
    } );
} )();
