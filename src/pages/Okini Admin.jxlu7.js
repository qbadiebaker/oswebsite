import wixData from 'wix-data';

// ====================================================================
// --- Configuration ---
const DATASET_ID = "#dataset1"; // Connected to Operations (Import3)
const FAMILIES_COLLECTION = "Import4"; 
const DONORS_COLLECTION_ID = "Import5"; 
const APPROVAL_FIELD_KEY = "approvedDonor";
// ====================================================================

$w.onReady(function () {
    updateNewDonorCount();

    // NEW: Apply the default filter (archive off) as soon as the dataset is ready
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

    // 3. Keep color updated on repeater changes
    $w('#requestsRepeater').onItemReady(($item, itemData, index) => {
        const isArchiveMode = $w('#switch3').checked;
        $item('#box151').style.backgroundColor = isArchiveMode ? "#FFE4B5" : "#FCFFD0"; 
    });
});

/**
 * Searches Operations and Linked Families, and handles Archive filtering.
 */
async function applyFilters() {
    let searchValue = $w('#input1').value.trim();
    let isArchiveMode = $w('#switch3').checked;

    // Start with a blank filter
    let opsFilter = wixData.filter();

    // -----------------------------------------------------------
    // 1. APPLY ARCHIVE FILTER
    // -----------------------------------------------------------
    if (isArchiveMode) {
        opsFilter = opsFilter.eq("archive", true);
    } else {
        // Shows items where 'archive' is false OR empty (null)
        opsFilter = opsFilter.ne("archive", true); 
    }

    // -----------------------------------------------------------
    // 2. APPLY SEARCH FILTER (If user typed something)
    // -----------------------------------------------------------
    if (searchValue !== "") {
        
        let matchingFamilyIds = [];
        
        // STEP A: Search the Families collection for matching text across all requested fields
        try {
            let familyQuery = wixData.query(FAMILIES_COLLECTION)
                .contains("headOfFamily", searchValue)
                .or(wixData.query(FAMILIES_COLLECTION).contains("familyMembers", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("familyDescription", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("primaryMailingAddress", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("directionsPhysicalLocation", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("phone", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("email", searchValue))
                .or(wixData.query(FAMILIES_COLLECTION).contains("staffNotes", searchValue));

            let familyResults = await familyQuery.find();
            
            matchingFamilyIds = familyResults.items.map(fam => fam._id);
        } catch (err) {
            console.error("Failed to query Families collection:", err);
        }

        // STEP B: Build the search filter for the Operations dataset across all requested fields
        let textFilter = wixData.filter()
            .contains("requestDonationDetails", searchValue)
            .or(wixData.filter().contains("sizeDetails", searchValue))
            .or(wixData.filter().contains("forWho", searchValue))
            .or(wixData.filter().contains("staffNotes", searchValue));

        // STEP C: If we found matching families, add them to our Operations search criteria
        if (matchingFamilyIds.length > 0) {
            textFilter = textFilter.or(wixData.filter().hasSome("linkedFamily", matchingFamilyIds));
        }

        // Combine the Archive filter AND the Search filter
        opsFilter = opsFilter.and(textFilter);
    }

    // -----------------------------------------------------------
    // 3. EXECUTE FILTER ON DATASET
    // -----------------------------------------------------------
    try {
        await $w(DATASET_ID).setFilter(opsFilter);
        console.log("Filter applied successfully.");
    } catch (error) {
        console.error("Failed to filter dataset:", error);
    }
}

/**
 * Updates the background color of the repeater.
 */
function updateRepeaterColors() {
    const isArchiveMode = $w('#switch3').checked;
    const bgColor = isArchiveMode ? "#FFE4B5" : "#FCFFD0"; 
    
    $w('#requestsRepeater').forEachItem(($item) => {
        $item('#box151').style.backgroundColor = bgColor;
    });
}

/**
 * Queries the Donors collection to count unapproved items.
 */
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