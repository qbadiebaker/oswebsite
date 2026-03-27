import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';

// ====================================================================
// --- Configuration ---
const DATASET_ID = "#dataset1";
const TABLE_ID = "#donorsTable";

// Ensure this is your Operations collection name
const OPERATIONS_COLLECTION = "Import3"; 
// ====================================================================

let debounceTimer;
let activeDonorIds = []; // Caches donors who have active requests

$w.onReady(function () {
    setupRowSelect();
    
    // 1. Load active donor IDs immediately so statuses are ready
    loadActiveDonors().then(() => {
        // Apply initial blank filters & populate table once the dataset is ready
        $w(DATASET_ID).onReady(() => {
            applyFilters(); 
        });
    });

    // 2. Search bar instant search
    $w('#input1').onInput(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => applyFilters(), 500);
    });

    // 3. Button and Enter key
    $w('#button28').onClick(() => applyFilters());
    $w('#input1').onKeyPress((event) => {
        if (event.key === "Enter") applyFilters();
    });

    // 4. Dropdowns
    $w('#dropdown1').onChange(() => applyFilters());
    $w('#dropdown2').onChange(() => applyFilters());
});

/**
 * Finds all unarchived operations to identify donors "Awaiting Fulfillment"
 */
async function loadActiveDonors() {
    try {
        const activeOps = await wixData.query(OPERATIONS_COLLECTION)
            .ne("archive", true)
            .include("linkedDonor") // <--- FIX: Forces Wix to load the Multi-Reference data
            .limit(1000)
            .find();
        
        let ids = new Set();
        activeOps.items.forEach(op => {
            // Because of .include(), linkedDonor is now an array of full Donor Objects
            if (op.linkedDonor && Array.isArray(op.linkedDonor)) {
                op.linkedDonor.forEach(donorObj => {
                    if (donorObj._id) {
                        ids.add(donorObj._id); // Extract the ID from the object
                    } else if (typeof donorObj === "string") {
                        ids.add(donorObj); // Fallback just in case
                    }
                });
            }
        });
        
        activeDonorIds = Array.from(ids);
        console.log("✅ Successfully loaded Active Donor IDs:", activeDonorIds); 
        
    } catch (error) {
        console.error("Failed to load active donors:", error);
    }
}

/**
 * Master filter function for Search and Dropdowns
 */
async function applyFilters() {
    let searchTerm = $w('#input1').value ? $w('#input1').value.trim() : "";
    let statusValue = $w('#dropdown1').value;
    let coordinatorValue = $w('#dropdown2').value;

    let mainFilter = wixData.filter();

    // --- 1. COORDINATOR FILTER ---
    if (coordinatorValue && coordinatorValue !== "") {
        let coordOps = await wixData.query(OPERATIONS_COLLECTION)
            .contains("coordinator", coordinatorValue)
            .include("linkedDonor") // <--- FIX: Applied to Coordinator search as well
            .limit(1000)
            .find();
        
        let coordDonorIds = [];
        coordOps.items.forEach(op => {
            if (op.linkedDonor && Array.isArray(op.linkedDonor)) {
                op.linkedDonor.forEach(donorObj => {
                    if (donorObj._id) coordDonorIds.push(donorObj._id);
                    else if (typeof donorObj === "string") coordDonorIds.push(donorObj);
                });
            }
        });

        if (coordDonorIds.length === 0) {
            mainFilter = mainFilter.eq("_id", "force-empty-no-match");
        } else {
            mainFilter = mainFilter.hasSome("_id", coordDonorIds);
        }
    }

    // --- 2. STATUS FILTER ---
    if (statusValue === "pendingApproval") {
        mainFilter = mainFilter.ne("approvedDonor", true);
    } else if (statusValue === "awaitingFulfillment") {
        mainFilter = mainFilter.eq("approvedDonor", true);
        if (activeDonorIds.length > 0) {
            mainFilter = mainFilter.hasSome("_id", activeDonorIds);
        } else {
            mainFilter = mainFilter.eq("_id", "force-empty-no-match");
        }
    } else if (statusValue === "fulfilledInactive") {
        mainFilter = mainFilter.eq("approvedDonor", true);
        if (activeDonorIds.length > 0) {
            mainFilter = mainFilter.not(wixData.filter().hasSome("_id", activeDonorIds));
        }
    }

    // --- 3. TEXT SEARCH ---
    if (searchTerm !== "") {
        mainFilter = mainFilter.and(
            wixData.filter().contains("donorName", searchTerm)
            .or(wixData.filter().contains("organizationName", searchTerm))
            .or(wixData.filter().contains("donorEmail", searchTerm))
            .or(wixData.filter().contains("phone", searchTerm))
            .or(wixData.filter().contains("staffNotes", searchTerm))
        );
    }

    // --- 4. EXECUTE & UPDATE TABLE ---
    try {
        await $w(DATASET_ID).setFilter(mainFilter);
        let totalCount = $w(DATASET_ID).getTotalCount();
        
        // Fetch matching items
        let results = await $w(DATASET_ID).getItems(0, totalCount > 0 ? totalCount : 1);
        
        // Inject custom status text
        let newRows = results.items.map(item => {
            let statusText = "🔵 Fulfilled / Inactive";
            
            if (item.approvedDonor !== true) {
                statusText = "🔴 Pending Approval";
            } else if (activeDonorIds.includes(item._id)) {
                statusText = "🟠 Awaiting Fulfillment";
            }

            return {
                ...item,
                donorStatusIndicator: statusText
            };
        });

        $w(TABLE_ID).rows = newRows;
        
        // Update feedback text
        if (totalCount > 0) {
            $w('#messageText').text = `Showing ${totalCount} donors.`;
        } else {
            $w('#messageText').text = "No donors found matching your criteria.";
        }
        $w('#messageText').expand();

    } catch (error) {
        console.error("Filter failed:", error);
    }
}

/**
 * Row Selection for Table Navigation
 */
function setupRowSelect() {
    $w(TABLE_ID).onRowSelect((event) => {
        const itemPageLink = event.rowData['link-donors-donorId']; 
        if (itemPageLink) {
            wixLocationFrontend.to(itemPageLink);
        }
    });
}