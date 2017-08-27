# GaragePay
Application to manage the parking lots.


### Project Structure
* main.js - Main application file. Contains function to route the HTTP requests and some helper methods.
* db_connect.js - Database connection definitions.
* views - folder, contains .ejs files.
* public - folder, accessable for users, contains css subfolder.

### Demo usage
* Go to `http://igorgrabarski.com:3000` 
* Print a ticket button - emulates the entering into garage. Application checks if there is a free parking lot- if Yes, the ticket is printed and user is allowed to go in; if No, user is provided with the prompt window to enter phone number. When one of the vehicles leaves the garage, user receives SMS message.

* Pay for parking - emulates the payment machine. User can choose the preffered rate to pay.
* Exit - emulates the checking of the ticket before exit. 
