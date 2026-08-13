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
        // Fetch Families (Increased limit to ensure we grab enough to sort properly)
        let familyResults = await wixData.query('Import4')
            .limit(150) 
            .find();

        let families = familyResults.items;

        // Fetch Requests concurrently
        allFamiliesWithRequests = await Promise.all(families.map(async (family) => {
            let reqResults = await wixData.query('Import3')
                .hasSome('linkedFamily', [family._id])
                .find();
            
            // Sort the requests internally so the newest request is always first in the text list
            let requests = reqResults.items;
            requests.sort((a, b) => new Date(b._createdDate).getTime() - new Date(a._createdDate).getTime());
            
            family.requests = requests;

            // Determine the timestamp of the most recent request for sorting the families
            family.latestRequestTime = requests.length > 0 
                ? new Date(requests[0]._createdDate).getTime() 
                : 0; // 0 pushes families with no requests to the bottom

            return family;
        }));

        // Sort the entire Families array by whoever has the most recent request
        allFamiliesWithRequests.sort((a, b) => b.latestRequestTime - a.latestRequestTime);

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

    let filteredData = [];

    // Loop through our global array of families
    for (let i = 0; i < allFamiliesWithRequests.length; i++) {
        let family = allFamiliesWithRequests[i];
        
        // 1. FILTER THE NESTED REQUESTS
        // We only want to look at requests that match the Archive mode & Dropdowns
        let matchingRequests = family.requests.filter(
            /** @param {any} req */
            (req) => {
            let isArchived = req.archive === true;
            let archiveMatch = archiveMode ? isArchived : !isArchived;
            let okiniMatch = selectedOkini ? req.whichOkini === selectedOkini : true;
            let coordMatch = selectedCoordinator ? req.coordinator === selectedCoordinator : true;
            
            return archiveMatch && okiniMatch && coordMatch;
        });

        // 2. SEARCH LOGIC (Checks Family AND Request details)
        let matchesSearch = true;
        if (searchTerm) {
            let headName = family.headOfFamily ? family.headOfFamily.toLowerCase() : "";
            let famId = family.familyId ? family.familyId.toLowerCase() : "";
            let phone = family.phone ? family.phone.toLowerCase() : "";
            let email = family.email ? family.email.toLowerCase() : "";
            
            let familyMatches = headName.includes(searchTerm) || famId.includes(searchTerm) || phone.includes(searchTerm) || email.includes(searchTerm);

            let requestsMatch = matchingRequests.some((/** @type {any} */ req) => {
                let reqTitle = req.requestDonationDetails ? req.requestDonationDetails.toLowerCase() : "";
                let forWho = req.forWho ? req.forWho.toLowerCase() : "";
                let notes = req.requestNotes ? req.requestNotes.toLowerCase() : "";
                return reqTitle.includes(searchTerm) || forWho.includes(searchTerm) || notes.includes(searchTerm);
            });

            matchesSearch = familyMatches || requestsMatch;
        }

        // 3. VISIBILITY LOGIC
        let hasMatchingRequests = matchingRequests.length > 0;
        let passesFilters = true;
        
        // If they are explicitly filtering (dropdowns or archive), hide families that have 0 matching requests
        if (selectedOkini || selectedCoordinator || archiveMode) {
            passesFilters = hasMatchingRequests;
        }

        // 4. APPLY TO REPEATER
        if (matchesSearch && passesFilters) {
            // Shallow copy the family so we don't accidentally delete data from the global array
            let familyCopy = Object.assign({}, family);
            familyCopy.requests = matchingRequests; 
            filteredData.push(familyCopy);
        }
    }

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
        
        let requestLines = itemData.requests.map(
            /** 
             * @param {any} req 
             * @param {number} index 
             */
            (req, index) => {
            let reqTitle = req.requestDonationDetails || "Untitled Request";
            let forWho = req.forWho || "N/A";
            let details = req.requestNotes || "N/A"; 
            let coord = req.coordinator || "Unassigned";
            
            let okiniIcon = (req.whichOkini === "Holiday" || req.whichOkini === "holiday") ? "🎄 Holiday" : "📦 Regular";
            let websiteStatus = req.liveOnWebsite ? "✅ Posted" : "🟧 Not posted";
            
            let urgentStatus = req.urgentNeedStatus 
                ? "<span style='color:#8B0000; font-weight:bold;'>🚨 URGENT</span>" 
                : "Normal";
                
            let archiveStatus = req.archive ? "🗃️ Archived" : "📂 Active";

            // Format the creation date nicely
            let createdString = "Unknown";
            if (req._createdDate) {
                let dateObj = new Date(req._createdDate);
                createdString = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            
            return `<div style="margin-bottom: 10px;">
                        <b>Req ${index + 1}:</b> ${reqTitle} <br>
                        <span style="margin-left: 15px;"><b>For:</b> ${forWho} &nbsp;|&nbsp; <b>Details:</b> ${details}</span><br>
                        <span style="margin-left: 15px;"><b>Coord:</b> ${coord} &nbsp;|&nbsp; ${okiniIcon} &nbsp;|&nbsp; ${websiteStatus} &nbsp;|&nbsp; <b>Need:</b> ${urgentStatus} &nbsp;|&nbsp; <b>Status:</b> ${archiveStatus}</span><br>
                        <span style="margin-left: 15px; font-size: 13px; color: #777;"><b>Created:</b> ${createdString}</span>
                    </div>`;
        });
        
        // Joins multiple requests with a faint dividing line for readability
        requestsHtml = requestLines.join("<hr style='border: 0; border-top: 1px dashed #ccc; margin: 15px 0;'>");
        
    } else {
        requestsHtml = "<i style='color: #777;'>No requests linked to this family yet.</i>";
    }
    
    $item('#requestInfo').html = `<div style="font-size:15px; line-height:1.8em;">${requestsHtml}</div>`;

    // EDIT BUTTON ROUTING
    $item('#editFamily').onClick(() => {
        wixLocation.to(`/newokinipost?familyId=${itemData._id}`); 
    });
});