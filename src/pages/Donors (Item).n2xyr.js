import wixData from 'wix-data';

// ====================================================================
// --- Configuration ---
const COLLECTIONS = {
    // FIX: Corrected the collection name based on your schema pattern.
    DONORS: "Import5", 
    OPERATIONS: "Import3"
};

const FIELDS = {
    // Multi-reference field on the Donors collection.
    DONOR_OPERATIONS_REF: "Import3_linkedDonor",
    // Multi-reference field on the Operations collection.
    OP_DONOR_REF_REVERSE: "linkedDonor"
};
// ====================================================================

$w.onReady(function () {
    setInitialUiState();
    $w('#dynamicDataset').onReady(() => {
        const currentDonor = $w('#dynamicDataset').getCurrentItem();
        if (!currentDonor) {
            console.error("PAGE LOAD FAILED: Could not load Donor item.");
            return;
        }
        setupLinkedOperationsRepeater(currentDonor);
        setupSearchAndLink(currentDonor);
    });
});

/**
 * Configures the repeater and its "Remove" button with error handling.
 * @param {object} currentDonor The currently displayed donor item.
 */
function setupLinkedOperationsRepeater(currentDonor) {
    $w('#donorsDonationsAndFamiliesRepeater').onItemReady(($item, itemData, index) => {
        $item('#removeLinkedRequestOrDonationButton').onClick(async () => {
            const operationToRemove = itemData;
            $item('#removeLinkedRequestOrDonationButton').disable();
            console.log(`Removing link for Operation ID: ${operationToRemove._id}`);

            // FIX: Added try...catch for robust error logging.
            try {
                await wixData.removeReference(COLLECTIONS.DONORS, FIELDS.DONOR_OPERATIONS_REF, currentDonor._id, operationToRemove._id);
                await wixData.removeReference(COLLECTIONS.OPERATIONS, FIELDS.OP_DONOR_REF_REVERSE, operationToRemove._id, currentDonor._id);
                await $w('#dataset2').refresh();
            } catch (error) {
                console.error("Failed to remove reference:", error);
                // Re-enable the button if it fails
                $item('#removeLinkedRequestOrDonationButton').enable();
            }
        });
    });
}

/**
 * Sets up the search and link UI with error handling.
 * @param {object} currentDonor The currently displayed donor item.
 */
function setupSearchAndLink(currentDonor) {
    const searchTable = $w('#requestDonationSearchTable');
    const searchInput = $w('#requestTableSearchInput');

    $w('#linkExistingRequestOrDonationButton').onClick(() => {
        searchTable.expand();
        searchInput.expand();
    });

    searchInput.onInput(() => {
        filterOperationsTable(searchInput.value);
    });

    searchTable.onRowSelect(async (event) => {
        const selectedOperation = event.rowData;
        console.log(`Linking Operation ID: ${selectedOperation._id}`);

        searchTable.collapse();
        searchInput.collapse();
        searchInput.value = "";
        await filterOperationsTable("");

        // FIX: Added try...catch for robust error logging.
        try {
            await wixData.insertReference(COLLECTIONS.DONORS, FIELDS.DONOR_OPERATIONS_REF, currentDonor._id, selectedOperation._id);
            await wixData.insertReference(COLLECTIONS.OPERATIONS, FIELDS.OP_DONOR_REF_REVERSE, selectedOperation._id, currentDonor._id);
            await $w('#dataset2').refresh();
        } catch (error) {
            console.error("Failed to insert reference:", error);
        }
    });
}

async function filterOperationsTable(searchTerm) {
    let filter = wixData.filter();
    if (searchTerm && searchTerm.length > 0) {
        filter = filter.contains("operationId", searchTerm)
            .or(wixData.filter().contains("requestDonationDetails", searchTerm));
    }
    await $w('#dataset1').setFilter(filter);
}

function setInitialUiState() {
    $w('#requestDonationSearchTable').collapse();
    $w('#requestTableSearchInput').collapse();
}