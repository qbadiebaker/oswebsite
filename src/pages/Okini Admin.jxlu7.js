import wixData from 'wix-data';

// ====================================================================
// --- Configuration ---
const DATASET_ID = "#dataset1"; // Connected to Operations (Import3)
const FAMILIES_COLLECTION = "Import4"; 
const DONORS_COLLECTION_ID = "Import5"; 
const APPROVAL_FIELD_KEY = "approvedDonor";

// Dropdown CMS Field Keys
const DROPDOWN_1_FIELD = "whichOkini";  // Linked to #dropdown1
const DROPDOWN_2_FIELD = "coordinator"; // Linked to #dropdown2
// ====================================================================

$w.onReady(function () {
    updateNewDonorCount();

    // Apply the default filter as soon as the dataset is ready
    $w(DATASET_ID).onReady(() => {
        applyFilters();
    });

    // 1. Search button & Enter key
    $w('#vectorImage1').onClick(() => applyFilters());
    $w('#input1').onKeyPress((event) => {
        if (event.key === "Enter") applyFilters();
    });

    // 2. Archive switch toggle
    $w('#switch3').onChange(() => {
        applyFilters();
        updateRepeaterColors();
    });

    // 3. Dropdown changes (Separated to satisfy TypeScript)
    $w('#dropdown1').onChange(() => applyFilters());
    $w('#dropdown2').onChange(() => applyFilters());

// 4. RESET BUTTON 
    // (Make sure you actually have a button with the ID #resetButton on your page!)
    $w('#resetButton').onClick(() => {
        // Clear all input values
        $w('#input1').value = "";
        $w('#dropdown1').value = null;
        $w('#dropdown2').value = null;
        $w('#switch3').checked = false; 
        
        // Re-apply the blank filters to reset the dataset
        applyFilters();
        updateRepeaterColors();
    });

    // 5. Keep color updated on repeater changes
    $w('#requestsRepeater').onItemReady(($item, itemData, index) => {
        const isArchiveMode = $w('#switch3').checked;
        $item('#box151').style.backgroundColor = isArchiveMode ? "#FFE4B5" : "#FCFFD0"; 
    });
});

/**
 * Searches Operations, Linked Families, Archive state, and Dropdowns.
 */
async function applyFilters() {
    let searchValue = $w('#input1').value.trim();
    let isArchiveMode = $w('#switch3').checked;
    
    // Get dropdown values
    let drop1Value = $w('#dropdown1').value;
    let drop2Value = $w('#dropdown2').value;

    // Start with a blank filter
    let opsFilter = wixData.filter();

    // -----------------------------------------------------------
    // 1. APPLY ARCHIVE FILTER
    // -----------------------------------------------------------
    if (isArchiveMode) {
        opsFilter = opsFilter.eq("archive", true);
    } else {
        opsFilter = opsFilter.ne("archive", true); 
    }

    // -----------------------------------------------------------
    // 2. APPLY DROPDOWN FILTERS
    // -----------------------------------------------------------
    if (drop1Value && drop1Value !== "") {
        opsFilter = opsFilter.eq(DROPDOWN_1_FIELD, drop1Value);
    }
    
    if (drop2Value && drop2Value !== "") {
        opsFilter = opsFilter.eq(DROPDOWN_2_FIELD, drop2Value);
    }

    // -----------------------------------------------------------
    // 3. APPLY TEXT SEARCH FILTER
    // -----------------------------------------------------------
    if (searchValue !== "") {
        let matchingFamilyIds = [];
        
        try {
            let familyQuery = wixData.query(FAMILIES_COLLECTION)
                .contains("headOfFamily", searchValue)
                .or(wixData.query(FAMILIES_COLLECTION).contains("familyMembers", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("familyDescription", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("primaryMailingAddress", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("directionsPhysicalLocation", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("phone", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("email", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("staffNotes", searchValue))
                .limit(1000); 

            let familyResults = await familyQuery.find();
            matchingFamilyIds = familyResults.items.map(fam => fam._id);
        } catch (err) {
            console.error("Failed to query Families collection:", err);
        }

        let textFilter = wixData.filter()
            .contains("requestDonationDetails", searchValue)
            .or(wixData.filter().contains("sizeDetails", searchValue))
            .or(wixData.filter().contains("forWho", searchValue))
            .or(wixData.filter().contains("staffNotes", searchValue));

        if (matchingFamilyIds.length > 0) {
            textFilter = textFilter.or(wixData.filter().hasSome("linkedFamily", matchingFamilyIds));
        }

        opsFilter = opsFilter.and(textFilter);
    }

    // -----------------------------------------------------------
    // 4. EXECUTE FILTER ON DATASET
    // -----------------------------------------------------------
    try {
        await $w(DATASET_ID).setFilter(opsFilter);
        console.log("Filters applied successfully.");
    } catch (error) {
        console.error("Failed to filter dataset:", error);
    }
}

function updateRepeaterColors() {
    const isArchiveMode = $w('#switch3').checked;
    const bgColor = isArchiveMode ? "#FFE4B5" : "#FCFFD0"; 
    
    $w('#requestsRepeater').forEachItem(($item) => {
        $item('#box151').style.backgroundColor = bgColor;
    });
}

async function updateNewDonorCount() {
    const countElement = $w('#text127'); 
    try {
        const count = await wixData.query(DONORS_COLLECTION_ID)
            .ne(APPROVAL_FIELD_KEY, true)
            .count();

        countElement.text = count === 1 
            ? "There is 1 donor pending approval" 
            : `There are ${count} donors pending approval`;
    } catch (error) {
        console.error("Failed to count new donors:", error);
        countElement.text = "Error loading donor count.";
    }
}