// State lookup dataset — mirrors the Google Sheet:
// https://docs.google.com/spreadsheets/d/1siSzGXndcN7wYAtTlKQb7n5qqlqqZvxbesrXk_2vGpw
// Columns: Line, Priorty, SCHEDULE, States, AGE Limit, Annual Income,
//          Form Link, Credentials, Instructions, Branch Code
(function () {
  var A6_STATES = ["AZ","FL","IA","IN","KS","LA","MI","MO","MS","MT","NE","OH","OK","TN","TX","WI"];
  var A10_STATES = ["FL","IN","KS","MS","MO","OH","OK","TN","TX","NC","GA."];
  var A3_STATES = ["AL","AZ","FL","IN","KS","LA","MI","MO","MS","NC","NE","OH","OK","SC","TN","TX","WI"];
  var A2_STATES = ["AZ","IN","MO","OH","TN","TX"];
  var A4_STATES = ["AL","AZ","FL","IA","IN","KS","LA","MI","MO","MS","MT","NC","OH","OK","SC","TN","TX"];

  var CREDS = "User Name: trackagent\nPassword: feinsurance6v8Ad&p#FX";
  var INSTR_TCPA = "This form is mandatory to fill before transfering the call\nNumber Must be clean in TCPA";
  var INSTR = "This form is mandatory to fill before transfering the call";

  function rows(line, priority, schedule, states, formLink, credentials, instructions, branch) {
    return states.map(function (s) {
      return [line, priority, schedule, s, "Between 18-64 Years", "Less than 50k",
              formLink, credentials, instructions, branch];
    });
  }

  window.STATE_DATA = []
    .concat(rows("A6 CPL: Blind Transfer", "1st Priority", "Mon - Fri |7:00 PM to 5:00 AM | PKT", A6_STATES, "web Form 1", "", INSTR_TCPA, "Please select AMLP"))
    .concat(rows("A10 CPL : Warm Transfer", "2nd Priority", "Mon - Sat | 8:00 PM - 6:00 AM | PKT", A10_STATES, "https://insurancefinal.com/wp-admin", CREDS, INSTR, ""))
    .concat(rows("A3 New line Blind Transfer", "3rd Priority", "", A3_STATES, "https://insurancefinal.com/wp-admin", CREDS, INSTR, ""))
    .concat(rows("A2 CPL : Blind Transfer", "4th Priority", "Mon - Fri | 7:30 PM to 5:00 AM | PKT", A2_STATES, "https://nextel-submission.vercel.app/", "", INSTR, ""))
    .concat(rows("A4 CPL : Blind Transfer", "", "Mon - Sat | 6:00 PM - 4:00 AM | PKT", A4_STATES, "https://insurifyhealthcare.com", "", INSTR, ""));
})();
