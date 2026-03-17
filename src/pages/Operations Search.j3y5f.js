// FINAL SIMPLIFIED CODE - All status filter functionality has been removed.
import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';

// REMOVED: No longer need a global variable for status filters.

// A timer for debouncing the search input to improve performance
let debounceTimer;

$w.onReady(function () {
    // --- Set up all page functionality ---
    setupRowSelect();
    // REMOVED: The call to setupFilterSelector() is gone.
    setupInstantSearch();

    $w('#dataset1').onReady(() => {
        updateFeedbackText();
    });
});

/**
 * Sets up the onRowSelect event for the operationsTable.
 * Remember to use the console.log() method from our last step to find your correct Field Key.
 */
function setupRowSelect() {
    $w('#operationsTable').onRowSelect((event) => {
        // DEBUGGING LOG: Leave this here to easily check the data for any row.
        console.log("Clicked Row Data:", event.rowData);
        
        // IMPORTANT: Replace this with the actual Field Key you found in your console.
        const itemPageLink = event.rowData['link-operations-operationId']; 
        
        if (itemPageLink) {
            wixLocationFrontend.to(itemPageLink);
        } else {
            console.error("Navigation failed: Could not find the link field. Check the object printed above for the correct Field Key.");
        }
    });
}

// REMOVED: The entire setupFilterSelector() function is deleted.

/**
 * Sets up an instant "as-you-type" search on the searchInput element.
 */
function setupInstantSearch() {
    $w('#searchInput').onInput(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            applyFilters();
        }, 500);
    });
}

/**
 * SIMPLIFIED: This master function now only creates a filter based on the search term.
 */
async function applyFilters() {
    const searchableFields = [
        'operationType', 'requestDonationDetails', 'sizeDetails',
        'forWho', 'donationMethod', 'requestNotes', 'staffNotes'
    ];

    let finalFilter = wixData.filter(); // Start with an empty filter (shows all items)
    let searchTerm = $w('#searchInput').value;

    // If there is a search term, create a search filter. Otherwise, the filter remains empty.
    if (searchTerm && searchTerm.length > 0) {
        const searchFilters = searchableFields.map(field => wixData.filter().contains(field, searchTerm));
        finalFilter = searchFilters.reduce((fullFilter, currentFilter) => fullFilter.or(currentFilter));
    }
    
    await $w('#dataset1').setFilter(finalFilter);
    updateFeedbackText();
}

/**
 * Updates the messageText element with the current item count.
 */
function updateFeedbackText() {
    const totalCount = $w('#dataset1').getTotalCount();
    if (totalCount > 0) {
        $w('#messageText').text = `Showing ${totalCount} operations.`;
        $w('#messageText').expand();
    } else {
        $w('#messageText').text = "No operations found matching your criteria.";
        $w('#messageText').expand();
    }
}