var express = require('express');
var app = express();
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

// Database connection
var db_connect = require('./db_connect');
var connection = db_connect.connection;

app.listen(3000);
console.log('Server listening on http://localhost:3000');

// Waiting list for vehicles if there are no free lots in the garage
var waitingList = [];

// ************************************** Main Page ********************************************
app.get('/', function (req, resp) {

    resp.render('index');

});



// ************************************* Enter Page *********************************************
/* 1. Check for free lots
*  2. Increase number of vehicles in garage by 1
*  3. Create new ticket for vehicle
*/
app.get('/enter', function (req, resp) {
    connection.beginTransaction(function (err) {
        if (err) {
            console.log(err);
            resp.send('Something went wrong on our side. Please try again.');
        }
        // Check for free lots
        connection.query('SELECT * FROM garage;', function (error, result) {
            if (error) {
                console.log('We have some problems.\n' + error);
            }
            if ((result[0].total_lots - result[0].total_vehicles) === 0) {

                /* There are no free parking lots
                *  Send request for client's phone number to add to the Waiting list
                */
                resp.send('client_phone');
            }
            else{
                // Increase the number of vehicles by 1 and update DB accordingly
                connection.query('UPDATE garage SET total_vehicles=? WHERE id=1;', [result[0].total_vehicles+1],
                    function (error) {
                    if (error) {
                        return connection.rollback(function () {
                            console.log('Could not update the number of vehicles');
                            throw error;
                        });
                    }
                });


                // Create new ticket and let vehicle in
                connection.query('INSERT INTO tickets(enter_time) VALUES(?);', [new Date()], function (error) {
                    if (error) {
                        return connection.rollback(function () {
                            console.log('Could not create new ticket');
                            throw error;
                        });
                    }
                });

                connection.query('SELECT max(id) AS MAX_ID FROM tickets', function (error, result) {
                    resp.send('Welcome to the parking! Your Ticket ID is ' + result[0].MAX_ID);

                });

            }
        });

        // Commit results
        connection.commit(function (err) {
            if (err) {
                return connection.rollback(function () {
                    console.log('Could not commit');
                });
            }
        });
        });
});



// ********************************** Pay for parking *******************************************
/* 1. Check if not paid yet
*  2. Update exit time by user choice(1,3, 6 or 24 hours)
*  3. Calculate the fee (In production - perform actual payment transaction)
*  4. Update paid_total in DB
*/
app.get('/pay_ticket/:id/:rate', function (req, resp) {

    // Check for Ticket ID validity
    if(!checkTicketId(req.params.id)){
        resp.send('Ticket ID may contain only digits.Please try again');
        return;
    }


    connection.beginTransaction(function (err) {
        if(err){
            console.log(err);
            resp.send('Something went wrong on our side. Please try again.');
        }

        connection.query('SELECT * FROM tickets WHERE id=?',[req.params.id], function (error1,result) {
            if(error1){
                console.log(error1);
            }

            // Pay only if not paid yet
            if(result.length !== 0 && result[0].paid !== 1){

                Date.prototype.addHours = function(h) {
                    this.setTime(this.getTime() + (h*60*60*1000));
                    return this;
                };

                // Update exit time
                var enterTime = new Date(result[0].enter_time);
                var exitTime = enterTime.addHours(req.params.rate);
                connection.query('UPDATE tickets SET exit_time=? WHERE id=?',[exitTime, req.params.id],
                    function (error2) {
                   if(error2){
                       console.log(error2);
                   }

                });

                // Update the payment in DB
                connection.query('SELECT * FROM pay_rates WHERE num_of_hours=?', [req.params.rate],
                    function (error3, result) {
                    if(error3){
                        console.log(error3);
                    }

                    connection.query('UPDATE tickets SET paid_total=? WHERE id=?', [result[0].rate,req.params.id],
                        function () {

                    });

                });

                connection.query('UPDATE tickets SET paid=1 WHERE id=?',[req.params.id], function (error4) {
                    if(error4){
                        return connection.rollback(function () {

                        });
                    }
                });

                resp.send("Payment successful. Your ticket is valid until " + exitTime);

            }
            else {
                return connection.rollback(function () {
                    resp.send("Ticket ID doesn't exist");

                });
            }
        });


        connection.commit(function (err2) {
            if (err2) {
                return connection.rollback(function () {
                    console.log('Could not commit');

                });
            }
        });
    });
});





// ************************************* Exit Page *********************************************
/* 1. Check if the ticket is paid/valid
*  2. Decrease number of vehicles in garage by 1
*  3. Transfer vehicle's row from tickets table to archive table
*  4. Send SMS to first vehicle in waitingList and shift it out
*/
app.get('/exit/:id', function (req, resp) {

    if(!checkTicketId(req.params.id)){
        resp.send('Ticket ID may contain only digits.Please try again');
        return;
    }


    connection.beginTransaction(function () {

        connection.query('SELECT * FROM tickets WHERE id=?', [req.params.id] ,function (error, result) {
            if(error){
                console.log(error);
                resp.send('Something went wrong on our side. Please try again.');
            }

            if(result[0].paid === 1 && result[0].exit_time >= Date.now()){
                connection.query('SELECT * FROM garage', function (error, result, fields) {

                    // Decrease the number of vehicles in garage by 1 and update DB accordingly
                    connection.query('UPDATE garage SET total_vehicles=? WHERE id=1;', [result[0].total_vehicles-1],
                        function (error) {
                        if (error) {
                            return connection.rollback(function () {

                            });

                        }
                    });

                });

                connection.query('SELECT * FROM tickets WHERE id=?',[req.params.id], function (error, result) {
                    if(error){
                        return connection.rollback(function () {

                        });
                    }
                    // Create row in archive table
                    connection.query('INSERT INTO archive(id,enter_time,exit_time,paid_total) VALUES(?,?,?,?);',
                        [result[0].id, result[0].enter_time,result[0].exit_time,result[0].paid_total],
                        function (error) {
                            if(error){
                                return connection.rollback(function () {

                                });

                            }

                        });
                    // Delete row from tickets table
                    connection.query('DELETE FROM tickets WHERE id=?',[req.params.id],
                        function (error) {
                            if(error){
                                return connection.rollback(function () {

                                });
                            }
                        });


                });

                // SEND SMS TO THE CLIENT
                if(waitingList.length > 0) {
                    sendSMS(waitingList.shift());
                }
                resp.send('Your ticket has been verified. Have a nice day!');

            }
            else {
                resp.send('You need to pay or your ticket is expired');
            }
        });


        connection.commit(function (err) {
            if(err){
                return connection.rollback();
            }
        });

    });

});


// ***************************** Adds vehicle to the waiting list *********************************
app.get('/put_on_waiting_list/:phone_number', function (req, resp) {
    resp.send('Great! Your phone number is ' + req.params.phone_number + '. We will update you!');
    waitingList.push(req.params.phone_number);
});



// ********************************** Sends SMS using Twilio API ***********************************
function sendSMS(phone_number) {
    var accountSid = 'AC75a3a9f27d36dedca8088645412002be';
    var authToken = '8db3882f3f9197839eb366350702ce15';

    var client = require('twilio')(accountSid, authToken);

    client.messages.create({
        to: phone_number,
        from: "+1 204-809-8569",
        body: "Dear Sir/Madam, We are happy to inform you that our BestParkingInTheCity has free lots. You are welcome!",
    }, function(err, message) {
        console.log(message.sid);
    });
}



// ******************************** Check Ticket ID for validity *************************************
// This function duplicates the one on the client side to block some illegal requests (for example sent with curl)
function checkTicketId(ticket_id) {

    const pattern = new RegExp('^[0-9]{1,}$');

    return !!pattern.exec(ticket_id);
}



