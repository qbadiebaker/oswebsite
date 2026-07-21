import wixLocationFrontend from 'wix-location-frontend';
import wixData from 'wix-data';

$w.onReady(function () {
    // Replace #repeaterId with the actual ID of your repeater
    $w("#repeater2").onItemReady( ($item, itemData, index) => {
        
        $item("#box149").onClick( () => {
            // This uses the correct, verified field key to navigate
            wixLocationFrontend.to(itemData["link-projects-projectName"]);
        });
    });
});