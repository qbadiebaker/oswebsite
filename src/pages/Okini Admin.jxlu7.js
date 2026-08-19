import wixData from 'wix-data';
import wixLocation from 'wix-location';

/** @type {any[]} */
let allFamiliesWithRequests = []; 

$w.onReady(async function () {
    // 1. FORCE CACHE CLEAR
    allFamiliesWithRequests = [];
    $w('#familyRepeater').data = [];
    $w('#familyRepeater').collapse();
    
    // 2. BIND REPEATER LOGIC (Must be inside onReady!)
    $w('#familyRepeater').onItemReady(($item, itemData) => {
        $item('#headOfFamily').text = itemData.headOfFamily || "Unnamed Family";
        $item('#familyComposition').text = itemData.familyDescription || "No composition provided.";
        $item('#familyStaffNotes').text = itemData.staffNotes || "No staff notes.";

        let requestsHtml = "";
        let requestsToDisplay = itemData.filteredRequests || [];
        let archiveMode = $w('#switch3').checked;
        
        let archiveCount = (itemData.totalRequests || []).filter((/** @type {any} */ r) => r.archive === true).length;
        
        if (requestsToDisplay.length > 0) {
            let requestLines = requestsToDisplay.map(
                /** 
                 * @param {any} req 
                 * @param {number} index 
                 */
                (req, index) => {
                let reqTitle = req.requestDonationDetails || "Untitled Request";
                let forWho = req.forWho || "N/A";
                let details = req.requestNotes || "N/A"; 
                let coord = req.coordinator || "Unassigned";
                let reqStaffNotes = req.staffNotes || "None"; 
                
                let okiniIcon = (req.whichOkini === "Holiday" || req.whichOkini === "holiday") ? "🎄 Holiday" : "📦 Regular";
                let websiteStatus = req.liveOnWebsite ? "✅ Posted" : "🟧 Not posted";
                let archiveStatus = req.archive ? "🗃️ Archived" : "📂 Active";

                let createdString = "Unknown";
                if (req._createdDate) {
                    let dateObj = new Date(req._createdDate);
                    createdString = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                
                return `<div style="margin-bottom: 10px;">
                            <b>Req ${index + 1}:</b> ${reqTitle} <br>
                            <span style="margin-left: 15px;"><b>For:</b> ${forWho} &nbsp;|&nbsp; <b>Details:</b> ${details}</span><br>
                            <span style="margin-left: 15px;"><b>Coord:</b> ${coord} &nbsp;|&nbsp; ${okiniIcon} &nbsp;|&nbsp; ${websiteStatus} &nbsp;|&nbsp; <b>Status:</b> ${archiveStatus}</span><br>
                            <span style="margin-left: 15px;"><b>Staff Notes:</b> ${reqStaffNotes}</span><br>
                            <span style="margin-left: 15px; font-size: 13px; color: #777;"><b>Created:</b> ${createdString}</span>
                        </div>`;
            });
            
            requestsHtml = requestLines.join("<hr style='border: 0; border-top: 1px dashed #ccc; margin: 15px 0;'>");
            
        } else {
            if (archiveMode) {
                requestsHtml = "<i style='color: #777;'>No archived requests.</i>";
            } else {
                if (archiveCount > 0) {
                    requestsHtml = `<i style='color: #777;'>No active requests. This family has ${archiveCount} archived request(s). Check the archive filter to view them.</i>`;
                } else {
                    requestsHtml = "<i style='color: #777;'>No requests linked to this family yet.</i>";
                }
            }
        }
        
        $item('#requestInfo').html = `<div style="font-size:15px; line-height:1.8em;">${requestsHtml}</div>`;

        $item('#editFamily').onClick(() => {
            wixLocation.to(`/newokinipost?familyId=${itemData._id}`); 
        });
    });

    // 3. LOAD DATA
    await loadAdminData();

    // 4. EVENT LISTENERS
    $w('#button28').onClick(() => applyFilters());
    $w('#dropdown1').onChange(() => applyFilters());
    $w('#dropdown2').onChange(() => applyFilters());
    $w('#switch3').onChange(() => applyFilters());
    $w('#resetButton').onClick(() => resetFilters());
});

// ==========================================
// HELPER FUNCTIONS (Safe to be outside)
// ==========================================
async function loadAdminData() {
    try {
        let familyResults = await wixData.query('Import4').limit(150).find();
        let families = familyResults.items;

        allFamiliesWithRequests = await Promise.all(families.map(async (family) => {
            let reqResults = await wixData.query('Import3')
                .hasSome('linkedFamily', [family._id])
                .find();
            
            let requests = reqResults.items;
            requests.sort((a, b) => new Date(b._createdDate).getTime() - new Date(a._createdDate).getTime());
            
            family.requests = requests;
            family.latestRequestTime = requests.length > 0 ? new Date(requests[0]._createdDate).getTime() : 0; 
            return family;
        }));

        allFamiliesWithRequests.sort((a, b) => b.latestRequestTime - a.latestRequestTime);

        applyFilters(); 
        $w('#familyRepeater').expand();

    } catch (error) {
        console.error("Error loading admin data:", error);
    }
}

function applyFilters() {
    let searchTerm = $w('#input1').value.toLowerCase(); 
    let selectedOkini = $w('#dropdown1').value;         
    let selectedCoordinator = $w('#dropdown2').value;   
    let archiveMode = $w('#switch3').checked;           

    let filteredData = [];

    for (let i = 0; i < allFamiliesWithRequests.length; i++) {
        let family = allFamiliesWithRequests[i];
        let allReqs = family.requests || [];
        
        let matchingRequests = allReqs.filter(
            /** @param {any} req */
            (req) => {
            let isArchived = req.archive === true;
            let archiveMatch = archiveMode ? isArchived : !isArchived;
            let okiniMatch = selectedOkini ? req.whichOkini === selectedOkini : true;
            let coordMatch = selectedCoordinator ? req.coordinator === selectedCoordinator : true;
            return archiveMatch && okiniMatch && coordMatch;
        });

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
                let staffNotes = req.staffNotes ? req.staffNotes.toLowerCase() : "";
                return reqTitle.includes(searchTerm) || forWho.includes(searchTerm) || notes.includes(searchTerm) || staffNotes.includes(searchTerm);
            });

            matchesSearch = familyMatches || requestsMatch;
        }

        let hasMatchingRequests = matchingRequests.length > 0;
        let passesFilters = true;
        
        if (selectedOkini || selectedCoordinator || archiveMode) {
            passesFilters = hasMatchingRequests;
        }

        if (matchesSearch && passesFilters) {
            let familyCopy = { ...family, filteredRequests: matchingRequests, totalRequests: allReqs };
            filteredData.push(familyCopy);
        }
    }

    $w('#familyRepeater').data = filteredData;
}

function resetFilters() {
    $w('#input1').value = "";
    $w('#dropdown1').value = "";
    $w('#dropdown2').value = "";
    $w('#switch3').checked = false;
    applyFilters();
}