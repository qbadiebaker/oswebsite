import wixData from 'wix-data';

// ====================================================================
// --- Configuration ---
const DATASET_ID = "#dataset1"; 
const FAMILIES_COLLECTION = "Import4"; 
const DONORS_COLLECTION_ID = "Import5"; 
const APPROVAL_FIELD_KEY = "approvedDonor";

const DROPDOWN_1_FIELD = "whichOkini";  
const DROPDOWN_2_FIELD = "coordinator"; 
// ====================================================================

$w.onReady(function () {
    updateNewDonorCount();

    // REMOVED the on-load applyFilters() completely.
    // The dataset will now load natively and safely using the Editor's default filter.

    // 1. Search button & Enter key triggers
    $w('#vectorImage1').onClick(() => applyFilters());
    $w('#input1').onKeyPress((event) => {
        if (event.key === "Enter") applyFilters();
    });

    // 2. Archive switch trigger
    $w('#switch3').onChange(() => applyFilters());

    // 3. Dropdown triggers
    $w('#dropdown1').onChange(() => applyFilters());
    $w('#dropdown2').onChange(() => applyFilters());

    // 4. RESET BUTTON
$w('#resetButton').onClick(() => {
        $w('#input1').value = "";
        $w('#dropdown1').value = null;
        $w('#dropdown2').value = null;
        $w('#switch3').checked = false; 
        
        applyFilters();
    });

    // 5. Keep colors updated automatically
    $w('#requestsRepeater').onItemReady(($item, itemData, index) => {
        const isArchiveMode = $w('#switch3').checked;
        $item('#box151').style.backgroundColor = isArchiveMode ? "#FFE4B5" : "#FCFFD0"; 
    });
});

/**
 * Searches Operations, Linked Families, Archive state, and Dropdowns.
 * This now ONLY runs when the user interacts with an input!
 */
async function applyFilters() {
    let searchValue = $w('#input1').value ? $w('#input1').value.trim() : "";
    let isArchiveMode = $w('#switch3').checked;
    
    let drop1Value = $w('#dropdown1').value;
    let drop2Value = $w('#dropdown2').value;

    let opsFilter = wixData.filter();

    // --- 1. ARCHIVE FILTER ---
    if (isArchiveMode) {
        opsFilter = opsFilter.eq("archive", true);
    } else {
        opsFilter = opsFilter.ne("archive", true); 
    }

    // --- 2. DROPDOWN FILTERS ---
    if (drop1Value && drop1Value !== "") {
        opsFilter = opsFilter.contains(DROPDOWN_1_FIELD, drop1Value);
    }
    if (drop2Value && drop2Value !== "") {
        opsFilter = opsFilter.contains(DROPDOWN_2_FIELD, drop2Value);
    }

    // --- 3. TEXT SEARCH FILTER ---
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

    // --- 4. EXECUTE FILTER ---
    try {
        await $w(DATASET_ID).setFilter(opsFilter);
        console.log("Filters applied successfully.");
    } catch (error) {
        console.error("Failed to filter dataset:", error);
    }
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