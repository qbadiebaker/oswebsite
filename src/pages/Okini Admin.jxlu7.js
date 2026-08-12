import wixData from 'wix-data';
import wixLocation from 'wix-location';

/** @type {any[]} */
let allFamiliesWithRequests = []; 

$w.onReady(async function () {
    $w('#familyRepeater').collapse();
    
    await loadAdminData();

    // Trigger search when the search button is clicked
    $w('#button28').onClick(() => applyFilters());
    
    // Trigger filters on change
    $w('#dropdown1').onChange(() => applyFilters());
    $w('#dropdown2').onChange(() => applyFilters());
    
    // Trigger archive mode toggle
    $w('#switch3').onChange(() => applyFilters());

    // Reset button
    $w('#resetButton').onClick(() => resetFilters());
});

async function loadAdminData() {
    try {
        // Fetch Families 
        let familyResults = await wixData.query('Import4')
            .descending('_createdDate')
            .limit(100) 
            .find();

        let families = familyResults.items;

        // Fetch Requests concurrently
        allFamiliesWithRequests = await Promise.all(families.map(async (family) => {
            let reqResults = await wixData.query('Import3')
                .hasSome('linkedFamily', [family._id])
                .find();
            
            family.requests = reqResults.items;
            return family;
        }));

        // Populate repeater initially
        applyFilters(); 
        $w('#familyRepeater').expand();

    } catch (error) {
        console.error("Error loading admin data:", error);
    }
}

// ==========================================
// FILTERING LOGIC
// ==========================================
function applyFilters() {
    let searchTerm = $w('#input1').value.toLowerCase(); 
    let selectedOkini = $w('#dropdown1').value;         
    let selectedCoordinator = $w('#dropdown2').value;   
    let archiveMode = $w('#switch3').checked;           

    let filteredData = allFamiliesWithRequests.filter((family) => {
        
        // 1. ARCHIVE MODE FILTER
        // Adjust "Archived" to match whatever value you use in your DB.
        let isArchived = family.status === "Archived";
        let passesArchiveCheck = archiveMode ? isArchived : !isArchived;

        if (!passesArchiveCheck) return false;

        // 2. SEARCH INPUT FILTER
        let matchesSearch = true;
        if (searchTerm) {
            let headName = family.headOfFamily ? family.headOfFamily.toLowerCase() : "";
            let famId = family.familyId ? family.familyId.toLowerCase() : "";
            matchesSearch = headName.includes(searchTerm) || famId.includes(searchTerm);
        }

        // 3. DROPDOWN FILTERS (Operations)
        let matchesOkini = true;
        let matchesCoord = true;

        if (selectedOkini || selectedCoordinator) {
            let matchingRequests = family.requests.filter((req) => {
                let okiniMatch = selectedOkini ? req.whichOkini === selectedOkini : true;
                let coordMatch = selectedCoordinator ? req.coordinator === selectedCoordinator : true;
                return okiniMatch && coordMatch;
            });
            
            if (selectedOkini) matchesOkini = matchingRequests.length > 0;
            if (selectedCoordinator) matchesCoord = matchingRequests.length > 0;
        }

        return matchesSearch && matchesOkini && matchesCoord;
    });

    $w('#familyRepeater').data = filteredData;
}

// ==========================================
// RESET LOGIC
// ==========================================
function resetFilters() {
    $w('#input1').value = "";
    $w('#dropdown1').value = "";
    $w('#dropdown2').value = "";
    $w('#switch3').checked = false;
    
    // Re-apply filters with empty values to show all default data
    applyFilters();
}

// ==========================================
// BIND DATA TO REPEATER UI
// ==========================================
$w('#familyRepeater').onItemReady(($item, itemData) => {
    
    $item('#headOfFamily').text = itemData.headOfFamily || "Unnamed Family";
    $item('#familyComposition').text = itemData.familyDescription || "No composition provided.";
    $item('#familyStaffNotes').text = itemData.staffNotes || "No staff notes.";

    let requestsHtml = "";
    
    if (itemData.requests && itemData.requests.length > 0) {
        
        let requestLines = itemData.requests.map((req, index) => {
            let reqTitle = req.requestDonationDetails || "Untitled Request";
            let forWho = req.forWho || "N/A";
            let size = req.sizeDetails || "N/A";
            let coord = req.coordinator || "Unassigned";
            
            let okiniIcon = (req.whichOkini === "Holiday" || req.whichOkini === "holiday") ? "🎄 Holiday" : "📦 Regular";
            let websiteStatus = req.liveOnWebsite ? "☑️ Live" : "⬜ Draft";
            
            let urgentStatus = req.urgentNeedStatus 
                ? "<span style='color:#8B0000; font-weight:bold;'>🚨 URGENT</span>" 
                : "Normal";
            
            return `<b>Req ${index + 1}:</b> ${reqTitle}, For: ${forWho}, Size/Details: ${size}, Coord: ${coord}, ${okiniIcon}, Website: ${websiteStatus}, Need: ${urgentStatus}`;
        });
        
        requestsHtml = requestLines.join("<br><br>");
        
    } else {
        requestsHtml = "<i>No requests linked to this family yet.</i>";
    }
    
    $item('#requestInfo').html = `<p style="font-size:15px; line-height:1.6em;">${requestsHtml}</p>`;

    // EDIT BUTTON ROUTING
    $item('#editFamily').onClick(() => {
        wixLocation.to(`/newokinipost?familyId=${itemData._id}`); 
    });
});