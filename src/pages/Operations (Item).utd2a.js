import wixData from 'wix-data';

// ====================================================================
// --- Configuration ---
const COLLECTIONS = {
    OPERATIONS: "Import3",
    FAMILIES: "Import4",
    DONORS: "Import5",
    INDIVIDUALS: "Import6"
};

const FIELDS = {
    OP_FAMILY_REF: "linkedFamily",
    OP_DONOR_REF: "linkedDonor",
    OP_INDIVIDUAL_REF: "linkedIndividual",
    OP_INDIVIDUAL_REF_REVERSE: "Import3_linkedIndividual",
    FAMILY_MEMBERS_REF: "Import6_import_4_linked_family_members",
    INDIVIDUAL_FAMILY_REF: "import_4_linked_family_members"
};
// ====================================================================

$w.onReady(function () {
    setInitialUiState();

    $w('#dynamicDataset').onReady(() => {
        const currentOperation = $w('#dynamicDataset').getCurrentItem();
        if (!currentOperation) {
            console.error("PAGE LOAD FAILED: The dynamic dataset could not load an item. Please check the URL.");
            return;
        }
        setupEventHandlers(currentOperation);
        $w('#dataset1').onReady(async () => {
            await populateMembersTableAndUpdateVisibility();
        });
    });

    // --- onBeforeSave handler for dataset7 ---
    $w('#dataset7').onBeforeSave(() => {
        const now = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const month = pad(now.getMonth() + 1);
        const day = pad(now.getDate());
        const hours = pad(now.getHours());
        const minutes = pad(now.getMinutes());
        const seconds = pad(now.getSeconds());
        const uniqueId = `IND-${year}${month}${day}${hours}${minutes}${seconds}`;

        // Set the ID field on the item being saved.
        $w('#dataset7').setFieldValue("individualId", uniqueId); // Use setFieldValue for single field

        // *** FIXED: Return true to allow the save operation to proceed ***
        return true;
    });

    // --- onAfterSave handler for dataset7 ---
    $w('#dataset7').onAfterSave(async (savedIndividual) => {
        const linkedFamily = await $w('#dataset1').getCurrentItem();
        if (linkedFamily && savedIndividual) {
            await wixData.insertReference(COLLECTIONS.FAMILIES, FIELDS.FAMILY_MEMBERS_REF, linkedFamily._id, savedIndividual._id);
            await wixData.insertReference(COLLECTIONS.INDIVIDUALS, FIELDS.INDIVIDUAL_FAMILY_REF, savedIndividual._id, linkedFamily._id);
        }
        await populateMembersTableAndUpdateVisibility();
    });
});

/**
 * Sets the initial collapsed state of search elements.
 */
function setInitialUiState() {
    $w('#familySearchTable, #input3, #donorSearchTable, #searchInput').collapse();
}

/**
 * Populates the table and updates visibility for the individuals section.
 */
async function populateMembersTableAndUpdateVisibility() {
    await $w('#dataset1').refresh();
    const linkedFamily = $w('#dataset1').getCurrentItem();

    if (linkedFamily) {
        const results = await wixData.query(COLLECTIONS.INDIVIDUALS)
            .hasSome(FIELDS.INDIVIDUAL_FAMILY_REF, linkedFamily._id)
            .find();
        $w('#familyMembersDisplayTable').rows = results.items;
        $w('#familyMembersDisplayTable, #linkedMemberRepeater, #box148').expand();
    } else {
        $w('#familyMembersDisplayTable').rows = [];
        $w('#familyMembersDisplayTable, #linkedMemberRepeater, #box148').collapse();
    }
}

/**
 * Sets up all interactive element event handlers for the page.
 * *** MODIFIED: Uses correct error text ID placeholder ***
 */
function setupEventHandlers(currentOperation) {
    const operationId = currentOperation._id;

    // *** Find the correct ID for your error text element in the Wix Editor ***
    // *** Replace '#<CORRECT_ERROR_TEXT_ID>' below with the actual ID ***
    const errorTextElement = $w('#text147'); // <-- REPLACE THIS ID

    $w('#AddNewMemberButton').onClick(async () => {
        try {
            // Clear previous errors if the element exists
            if (errorTextElement.rendered) {
                errorTextElement.collapse();
            }

            // Attempt to save. This will trigger all dataset validations.
            await $w('#dataset7').save();

            // Clear inputs on success
            $w('#newMemberAgeInput').value = null;
            $w('#newMemberBoyOrGirlInput').value = null;
            $w('#newMemberSizeOrInfoInput').value = null;

        } catch (err) {
            console.error("Failed to save new member:", err);

            // Display error message if the element exists
            if (errorTextElement.rendered) {
                if (err.message.includes("validation failed")) {
                    errorTextElement.text = "Please fill in all required member fields correctly.";
                } else {
                    errorTextElement.text = "An error occurred. Please try again.";
                }
                errorTextElement.expand();
            } else {
                // Fallback if the error element ID is wrong or missing
                console.error("Error text element not found. Message:", err.message);
            }
        }
    });

    // --- Other event handlers ---
    $w('#linkedFamilyRepeater').onItemReady(($item, itemData) => {
        $item('#removeLinkedFamilyButton').onClick(() => handleRemoveLink(operationId, itemData._id, 'Family'));
    });
    $w('#linkedDonorsRepeater').onItemReady(($item, itemData) => {
        $item('#removeLinkedDonorButton').onClick(() => handleRemoveLink(operationId, itemData._id, 'Donor'));
    });
    $w('#linkedMemberRepeater').onItemReady(($item, itemData) => {
        $item('#removeLinkedMemberButton').onClick(() => handleRemoveLink(operationId, itemData._id, 'Individual'));
    });
    $w('#addExistingFamily').onClick(() => $w('#familySearchTable, #input3').expand());
    $w('#addExistingDonor').onClick(() => $w('#donorSearchTable, #searchInput').expand());
    $w('#input3').onInput(() => filterSearchTable('Family'));
    $w('#searchInput').onInput(() => filterSearchTable('Donor'));
    $w('#familySearchTable').onRowSelect((event) => handleLink(operationId, event.rowData, 'Family'));
    $w('#donorSearchTable').onRowSelect((event) => handleLink(operationId, event.rowData, 'Donor'));
    $w('#familyMembersDisplayTable').onRowSelect((event) => handleLink(operationId, event.rowData, 'Individual'));
}


/**
 * Handles linking an item to the current Operation.
 */
async function handleLink(operationId, selectedItem, type) {
    try {
        let refField, linkedDataset;
        if (type === 'Family') {
            refField = FIELDS.OP_FAMILY_REF;
            linkedDataset = $w('#dataset1');
            $w('#familySearchTable, #input3').collapse();
        } else if (type === 'Donor') {
            refField = FIELDS.OP_DONOR_REF;
            linkedDataset = $w('#dataset5');
            $w('#donorSearchTable, #searchInput').collapse();
        } else if (type === 'Individual') {
            refField = FIELDS.OP_INDIVIDUAL_REF;
            linkedDataset = $w('#dataset3');
            // Check if reference already exists before inserting
             const existingRefs = await wixData.queryReferenced(COLLECTIONS.INDIVIDUALS, selectedItem._id, FIELDS.OP_INDIVIDUAL_REF_REVERSE);
             if (!existingRefs.items.some(ref => ref._id === operationId)) {
                await wixData.insertReference(COLLECTIONS.INDIVIDUALS, FIELDS.OP_INDIVIDUAL_REF_REVERSE, selectedItem._id, operationId);
             }
        }

        // Check if reference already exists before inserting
         const existingMainRefs = await wixData.queryReferenced(COLLECTIONS.OPERATIONS, operationId, refField);
         if (!existingMainRefs.items.some(ref => ref._id === selectedItem._id)) {
            await wixData.insertReference(COLLECTIONS.OPERATIONS, refField, operationId, selectedItem._id);
         }

        await linkedDataset.refresh();
        if (type === 'Family') await populateMembersTableAndUpdateVisibility();
    } catch (err) { console.error(`Error linking ${type}:`, err); }
}

/**
 * Handles removing a reference from the current Operation.
 */
async function handleRemoveLink(operationId, itemIdToRemove, type) {
    try {
        let refField, linkedDataset;
        if (type === 'Family') {
            const { items: individualsToRemove } = await $w('#dataset3').getItems(0, $w('#dataset3').getTotalCount());
            for (const individual of individualsToRemove) {
                // Ensure we only attempt to remove the link if it actually exists for this individual
                const opRefs = await wixData.queryReferenced(COLLECTIONS.INDIVIDUALS, individual._id, FIELDS.OP_INDIVIDUAL_REF_REVERSE);
                if (opRefs.items.some(ref => ref._id === operationId)) {
                   await handleRemoveLink(operationId, individual._id, 'Individual');
                }
            }
            refField = FIELDS.OP_FAMILY_REF;
            linkedDataset = $w('#dataset1');
        } else if (type === 'Donor') {
            refField = FIELDS.OP_DONOR_REF;
            linkedDataset = $w('#dataset5');
        } else if (type === 'Individual') {
            refField = FIELDS.OP_INDIVIDUAL_REF;
            linkedDataset = $w('#dataset3');
             // Check if reverse reference exists before removing
             const existingReverseRefs = await wixData.queryReferenced(COLLECTIONS.INDIVIDUALS, itemIdToRemove, FIELDS.OP_INDIVIDUAL_REF_REVERSE);
             if (existingReverseRefs.items.some(ref => ref._id === operationId)) {
                await wixData.removeReference(COLLECTIONS.INDIVIDUALS, FIELDS.OP_INDIVIDUAL_REF_REVERSE, itemIdToRemove, operationId);
             }
        }

         // Check if main reference exists before removing
         const existingMainRefs = await wixData.queryReferenced(COLLECTIONS.OPERATIONS, operationId, refField);
         if (existingMainRefs.items.some(ref => ref._id === itemIdToRemove)) {
            await wixData.removeReference(COLLECTIONS.OPERATIONS, refField, operationId, itemIdToRemove);
         }

        await linkedDataset.refresh();
        if (type === 'Family') await populateMembersTableAndUpdateVisibility();
    } catch (err) { console.error(`Error removing ${type} link:`, err); }
}


/**
 * Filters the search tables for Families or Donors.
 */
async function filterSearchTable(type) {
    let searchDataset, searchInput, searchableFields;
    if (type === 'Family') {
        searchDataset = $w('#dataset2');
        searchInput = $w('#input3');
        searchableFields = ['headOfFamily', 'familyMembers', 'familyDescription'];
    } else { // Donor
        searchDataset = $w('#dataset6');
        searchInput = $w('#searchInput');
        searchableFields = ['donorName', 'organizationName', 'donorEmail'];
    }
    const searchTerm = searchInput.value;
    let filter = wixData.filter();
    if (searchTerm && searchTerm.length > 0) {
        // Build the filter dynamically for each searchable field
        filter = searchableFields
            .map(field => wixData.filter().contains(field, searchTerm))
            .reduce((f1, f2) => f1.or(f2)); // Combine filters with OR
    }
    await searchDataset.setFilter(filter);
}