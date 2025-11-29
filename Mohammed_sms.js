//To send Initial SMS [emptyflag+10mins+sev>0 OR "finalSent"+10mins+sev>0]
//To send Final SMS ["problemSent"+55mins+Sev=0]

// Table name: smstable
// Attributes: (USERNAME – PHONENUM – PERSONGROUP)
// The value list of ‘persongroup’ attribute:
// (HOURLY DOWN SITES SMS - SITE STATUS SMS - VIP/EVENT SMS)

var DataSource = "ObjectServerForNOI";

var now = GetDate();
var tenMinutes = now-600;
var fifty5minutes = now-3300; 

var toSendQuery = "select Node,AlertGroup,OutageSubCategory,ICDEvent,ICDVIP,ServerSerial,Severity,SupplementaryInformation,AutomatedSMS,LastOccurrence,ClearedAt,Vendor from alerts.status where (ICDEvent='1' or ICDVIP='1' or ICDVIP='3') and ICDStatus = 'ONAIR' and( (Manager='Ericsson ENM Probe' and AlertGroup='Heartbeat Failure' ) or (AlertGroup like 'BASE STATION FAULTY' and Severity = 5) or AlertGroup in ('NE Is Disconnected','NE O&M CONNECTION FAILURE','No connection to BTS','NE3SWS AGENT NOT RESPONDING TO REQUESTS', 'EXTERNAL AL 1','EXTERNAL AL 2','EXTERNAL AL 3','EXTERNAL AL 7','EXTERNAL AL 8','BTS O&M LINK FAILURE','NE3S-WS Registration failed','CSL Fault')  or (AlertGroup = 'BASE STATION CONNECTIVITY LOST' and Severity = 5) or (AlertGroup = 'BASE STATION CONNECTIVITY PROBLEM' and Severity = 5) or (AlertGroup = 'GNE_CONNECT_FAIL' and Node = 'LCAIN10722') or (AlertGroup = 'NE_NOT_LOGIN' and Node = 'LCAIN10722') or(AlertGroup in ('Abnormal D.G. Start','Abnormal Fuel Level Decline','Abnormal Smart D.G. Start','Abnormal Smart D.G. Stop','Abnormal System Current Check','Abnormal System Voltage Check','AC Failure','AC Loop Abnormal','AC Phase L1 Failure','AC Phase L1 Overvoltage','AC Phase L1 Undervoltage','AC Phase L2 Failure','AC Phase L2 Overvoltage','AC Phase L2 Undervoltage','AC Phase L3 Failure','AC Phase L3 Overvoltage','AC Phase L3 Undervoltage','All Rectifiers Fail to Communicate ','Battery Charge Overcurrent','Battery Discharging','Battery Equalized Charging','Battery Forcibly Connection','Battery Fuse Break','Battery High Temperature','Battery Not Detected','Battery Testing','BLVD','BLVD Disconnected','BLVD Low Voltage Disconnected','BLVD Warning','Bus Bar Undervoltage','Charge Fault','D.G. Lose Phase','D.G. Running','DC Input Fail','Diesel Generator Fault','Diesel Generator Startup Failure','Insufficient Redundant Rectifiers','LLVD','LLVD Low Voltage Disconnected','LLVD Warning','Load Fuse Broken','Low Ambient Humidity','Low Ambient Temperature','Low Battery Capacity','Low Fuel Level','Low Rectifier Capacity','Mains Failure','Mains Phase L1 Failure','Mains Phase L1 Overvoltage','Mains Phase L1 Undervoltage','Mains Phase L2 Failure','Mains Phase L2 Overvoltage','Mains Phase L2 Undervoltage','Mains Phase L3 Failure','Mains Phase L3 Overvoltage','Mains Phase L3 Undervoltage','Mains Under Frequency','Manual Battery Connection','Multi-Rectifier Fault','Nonautomatic Mode SMSs[i]','PSU Communication Failure','PSU Protection','Rectifier Fault','Rectifier Missing','Rectifier Power Failure','Rectifier Protection','SOH Low','AC Surge Protector Fault','DC Undervoltage','Major Load Fuse Broken','Power System Charge Failure')) and Manager = 'Neteco Probe') )and (((AutomatedSMS='' or AutomatedSMS='finalSent') and LastOccurrence < " + tenMinutes + " and Severity >0 and Type=1) OR (AutomatedSMS='problemSent' and ClearedAt < " + fifty5minutes + " and Severity =0 and Type=1)) "

var SMSs = DirectSQL(DataSource,toSendQuery,false);
Log("Length");
Log(SMSs.length);

SMSs.forEach(function(alarm){

    var numbers = []; 
    var title = '';
    var text = '';
    var flag = '';

    //populate the reason
    var Reason = 'Under Investigation';
    if(alarm.OutageSubCategory != ''){
        Reason = alarm.OutageSubCategory;
    }
    var Action = 'Escalated to FM';
    var LO = Number(alarm.LastOccurrence)+600; 

    ////////////////////////////////////////////////////////////////
    
    // VENDOR SEPARATION --------------------
    var vendor = alarm.Vendor; // Vendor field from SQL

    if (vendor === "Huawei") {
        // Huawei numbers
        numbers.push("01234567890"); // replace with Huawei team numbers
        numbers.push("01234567891");
    } else if (vendor === "Nokia") {
        // Nokia numbers
        numbers.push("01555555555"); // replace with Nokia team numbers
        numbers.push("01555555556");
    }

    //If VIP
    if(alarm.ICDVIP =='1' || alarm.ICDVIP == '3'){
        var numbersQuery = "select PHONENUM from MAXIMO.smstable where PERSONGROUP like 'VIP/EVENT SMS'" ;
        allNumbers = DirectSQL('ICD_Prod_Standby',numbersQuery,false);
        for(var j=0;j<allNumbers.length;j++){
            numbers.push(allNumbers[j].PHONENUM);
        }
        title = 'VIP';
        Log("Hello VIP");
    //If Event
    } else if(alarm.ICDEvent == '1'){
        var numbersQuery = "select PHONENUM from MAXIMO.smstable where PERSONGROUP like 'VIP/EVENT SMS'" ;
        allNumbers = DirectSQL('ICD_Prod_Standby',numbersQuery,false);
        for(var j=0;j<allNumbers.length;j++){
            numbers.push(allNumbers[j].PHONENUM);
        }
        numbers.push("01555557873");
        title='Event';
    }

    //If Down site
    if( /NE Is Disconnected|NE O&M CONNECTION FAILURE|BTS O&M LINK FAILURE|FAILURE IN D-CHANNEL ACTIVATION OR RESTORATION|CELL SERVICE PROBLEM|CELL FAULTY|NE3SWS AGENT NOT RESPONDING TO REQUESTS|Cell Unavailable|GSM Cell out of Service|Heartbeat Failure/.test(alarm.AlertGroup)){
        if((alarm.AutomatedSMS == '' || alarm.AutomatedSMS == 'finalSent') && Number(alarm.LastOccurrence) < tenMinutes && Number(alarm.Severity) > 0){
            text = "Automatic Initial " + title + " Down:\n\nSite: " + alarm.Node + "\n\nEvent time: " +  LocalTime(Number(alarm.LastOccurrence),"MM/d/yyyy H:mm") + "\n\nReported Time: " + LocalTime(LO,"MM/d/yyyy H:mm") +"\n\nReason: " + Reason + "\n\nAction: "+ Action + "\n\n\nTE NOC";
            flag = "problemSent";
        } else if(alarm.AutomatedSMS == 'problemSent' && Number(alarm.ClearedAt < fifty5minutes) && Number(alarm.Severity) == 0){
            text = "Automatic Final "+ title +" Down:\n\nSite: " + alarm.Node + "\n\nEvent time: " +  LocalTime(Number(alarm.LastOccurrence),"MM/d/yyyy H:mm") + "\n\nReported Time: " + LocalTime(LO,"MM/d/yyyy H:mm") +  "\n\nClearance Time: " + LocalTime(Number(alarm.ClearedAt),"MM/d/yyyy H:mm") +"\n\nReason: " + Reason + "\n\nAction: "+ Action + "\n\n\nTE NOC" ; 
            flag = "finalSent";
        }
    }

    // Additional External AL, other alarms same as before...
    // (You can keep all your existing logic here)

    //Sending the SMS
    if(text != ''){ 
        var myparams = NewObject(); 
        myparams.systemid = 'ibmoss';
        myparams.password = '18m055';
        myparams.Originator = 'WE-MNOC'; 
        myparams.encoding = '0';
        myparams.ston = '5';
        myparams.snpi = '0';
        myparams.dton = '1'; 
        myparams.Registered_delivery = '0'; 
        myparams.msg_text = text;

        Log("message text = " +  myparams.msg_text) ;

        var myconfig = NewObject();
        myconfig['params']=myparams;

        numbers.forEach(function(number){
            myparams['dest_addr'] = number;
            myconfig['params']=myparams;
            if (text !== ''){
                result = RESTfulAPIGET("SMS","",myconfig);
            }
        });

        var flagQuery = "update alerts.status set AutomatedSMS = '" + flag + "' where ServerSerial = " + alarm.ServerSerial; 
        DirectSQL(DataSource,flagQuery,false);
    }    
});