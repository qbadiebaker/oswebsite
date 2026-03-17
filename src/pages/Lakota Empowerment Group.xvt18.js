// Velo code for expanding and collapsing elements (Optimized Version)
// -------------------------------------------------------------

$w.onReady(function () {

    // Map of which button controls which section(s)
    const toggleMap = {
        '#button19': ['#section28'],
        '#button18': ['#section23'],
        '#button22': ['#section29', '#section27'], // Controls two sections
        '#button21': ['#section32'],
        '#button23': ['#section35']
    };

    // This function handles the expand/collapse logic
    function toggleElements(elements) {
        elements.forEach(elementId => {
            let el = $w(elementId);
            if (el.collapsed) {
                el.expand();
            } else {
                el.collapse();
            }
        });
    }

    // This loop assigns the click event to each button in the map
    for (const buttonId in toggleMap) {
        $w(buttonId).onClick(() => {
            toggleElements(toggleMap[buttonId]);
        });
    }

});