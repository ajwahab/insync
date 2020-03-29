// - run form/script from appropriate G Suite account
// - replyto address will be list of team email address (mechanism for group repsponses)
// - Project properties (File --> Project properties --> Script properties) contains:
// -- ss_id (ID of Google Sheets spreadsheet associated with form)
// -- email_recipients (comma separated list of email addresses)
// -- form_url (URL of Google Form)
// - project has weekly triggers for:
// -- sending invitation
// -- sending results

function send_invitation(e) {
  Logger.log("send_invitation");
  MailApp.sendEmail({
    to: PropertiesService.getScriptProperties().getProperty('email_recipients'),
    replyto: PropertiesService.getScriptProperties().getProperty('email_recipients'),
    subject: "[BETA] Invitation to post update for " + tstamp_mmddyyyy(),
    htmlBody: "Get to <a href=\
              " + PropertiesService.getScriptProperties().getProperty('form_url') + "\
              >thePoint</a> before 3:00 PM."
  });
}

function delta_days(tstamp_ms0, tstamp_ms1) {
  var one_day_ms = 1000 * 60 * 60 * 24;
  if (tstamp_ms1 == null)
    tstamp_ms1 = (new Date()).getTime();
  return Math.round((tstamp_ms1 - tstamp_ms0) / one_day_ms);
}

function tstamp_mmddyyyy(tstamp) {
  if (tstamp == null)
    tstamp = new Date();
  return Utilities.formatDate(tstamp, "GMT-4", "MM.dd.yyyy");
}

function send_results(e) {
  Logger.log("send_results");
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('ss_id'));
  var sheet = ss.getSheets()[0];
  var range = sheet.getDataRange();
  var values = range.getValues();
  var entries = []
  var quests = [];
  var resps = [];
  // start at the last entry and work backwards
  for (var ent = values.length - 1; ent > 0; ent--) {
    var tstamp = new Date(values[ent][0]); // convert timestamp to date object
    // only consider results posted within the last day
    if (delta_days(tstamp) < 1) {
      quests = [];
      resps = [];
      // first two columns are timestamp and user email
      for (var rsp = 2; rsp < values[ent].length; rsp++) {
        quests.push(values[0][rsp]);
        resps.push(values[ent][rsp])
      }
      entries.push({timestamp: values[ent][0],
                    user_email: (values[ent][1]),
                    questions: quests,
                    responses: resps,
                    highlights: values[ent][2],
                    goals: values[ent][3],
                    thoughts: values[ent][4]});
    } else // stop scanning entries once timestamps are older than one day
      break;
  }
  if (entries.length) {
    // \todo replace nested loops with clever JS voodoo
    var entries1 = [];
    // \todo combine multiple entries from a single user, if they exist
    //       until then, just deep copy
    entries1 = JSON.parse(JSON.stringify(entries));
    // consolidate responses from all users for each question
    // [{question: null, user_resp: [{user: null, response: null}]}]
    // \todo replace nested loops with clever JS voodoo or directly pull columns from spreadsheet
    var entries2 = [];
    for (var q = 0; q < quests.length; q++) {
      var ur = [];
      for (var e = 0; e < entries1.length; e++) {
        ur.push({user_email: entries1[e].user_email, response: entries1[e].responses[q]});
      }
      entries2.push({question: quests[q], user_resp: ur});
    }
    // HTML format:
    // question0:
    //   user0:
    //     response
    //   user1:
    //     response
    // question1:
    // ...
    var email_body = "TopTip: click on user.name to send feedback to an individual.<br>";
    email_body += "ProTip: reply to address the entire team.<br>";
    for (var e = 0; e < entries2.length; e++) {
      var str_q = "<h3>" + entries2[e].question + "</h3>";
      var str_ur = '';
      for (var u = 0; u < entries2[e].user_resp.length; u++) {
        var usr_eml = entries2[e].user_resp[u].user_email;
        var usr = usr_eml.split('@', 1);
        var sbj = entries2[e].question + " " + tstamp_mmddyyyy();
        var bdy = encodeURI('\n........\n' + entries2[e].user_resp[u].response);
        var str_u = "<a href=\"mailto:" + usr_eml + "?subject=" + sbj + "&body=\
                    " + bdy + "\" target=\"_top\">" + usr + "</a>";
        var str_r = "<p style=\"margin-left: 40px\">\
                    " + entries2[e].user_resp[u].response.replace(/(?:\r\n|\r|\n)/g, '<br>') + "</p>";
        str_ur += str_u + str_r;
      }
      email_body += str_q + str_ur;
    }
    MailApp.sendEmail({
      to: PropertiesService.getScriptProperties().getProperty('email_recipients'),
      replyto: PropertiesService.getScriptProperties().getProperty('email_recipients'),
      subject: "[BETA] Update for " + tstamp_mmddyyyy(),
      htmlBody: email_body
    });
  }
}
