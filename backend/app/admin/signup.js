const path = require('path');
const fs = require('fs');
const { client } = require(
	path.join(process.env.APPLICATION_PATH, 'database.js')
);

const express = require('express');
const router = express.Router();

// **********************************************************************
const { DateTime } = require("luxon");
const TIME_ZONE = 'Asia/Tehran';

// **********************************************************************
// multer setup for file uploads
const multer = require("multer");
const UPLOADS_TMP = path.join(process.env.APPLICATION_PATH, 'tmp_dir');

var storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, UPLOADS_TMP);
    },
    filename: (req, file, cb) => {
		cb(null, file.fieldname + '-' + Date.now());
    }
});

const upload = multer({ storage: storage });

// **********************************************************************
// helper functions
function loadRejectHelper(res, field) {
	let response = {
		status: "reject",
		message: "server couldn't load " + field + " field!"
	}
	res.status(400).send(JSON.stringify(response));
}

function rejectHelper(res, field) {
	let response = {
		status: "reject",
		message: "ivalid " + field + " field!"
	}
	res.status(400).send(JSON.stringify(response));
}

function hasLengthError(str, max=32, min=3) {
    return str.length < min || max < str.length;
}

function isUsernameInvalid(username) {
	return (
		hasLengthError(username, 10) ||
		/^[0-9]/g.test(username) ||
		!/^[a-zA-Z0-9_]+$/g.test(username)
	);
}

// Validates that the input string is a valid date formatted as "yyyy-mm-dd"
function isValidDate(dateString)
{
    // First check for the pattern
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/g.test(dateString))
        return false;

    // Parse the date parts to integers
    let year = parseInt(dateString.substring(0, 4));
	let month = parseInt(dateString.substring(5, 7));
	let day = parseInt(dateString.substring(8));

    // Check the ranges of month and year
    if(year < 1960 || year > 2020 || month == 0 || month > 12)
        return false;

    var monthLength = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
    // Adjust for leap years
    if(year % 400 == 0 || (year % 100 != 0 && year % 4 == 0))
        monthLength[1] = 29;

    // Check the range of the day
    return day > 0 && day <= monthLength[month - 1];
};

// **********************************************************************
// load the body parameters needed to crete user object
function loadBodyParams(req, res) {
	let firstname = req.body.firstname;
	if (!firstname) return loadRejectHelper(res, "firstname");
	if (hasLengthError(firstname) || !/^[a-zA-Z\s]+$/g.test(firstname))
		return rejectHelper(res, "firtname");
	firstname = firstname.trim();

	let lastname = req.body.lastname;
	if (!lastname) return loadRejectHelper(res, "lastname");
	if (hasLengthError(lastname) || !/^[a-zA-Z\s]+$/g.test(lastname))
		return rejectHelper(res, "lastname");
	lastname = lastname.trim();

	let nationalID = req.body.nationalID;
	if (!nationalID) return loadRejectHelper(res, "nationalID");
	if (hasLengthError(nationalID, 10) || !/^[0-9]+$/g.test(nationalID))
		return rejectHelper(res, "nationalID");
	
	let birthDate = req.body.birthDate;
	if (!birthDate) return loadRejectHelper(res, "birthDate");
	if (birthDate.length != 10 || !isValidDate(birthDate))
		return rejectHelper(res, "birthDate");

	let username = req.body.username;
	if (!username) return loadRejectHelper(res, "username");
	if (isUsernameInvalid(username))
		return rejectHelper(res, "username");

	let password = req.body.password;
	if (!password) return loadRejectHelper(res, "password");
	if (hasLengthError(password) || /[\0\n\s]/g.test(password))
		return rejectHelper(res, "password");

	return {
		firstname: firstname.toLowerCase(),
		lastname: lastname.toLowerCase(),
		nationalID: nationalID,
		birthDate: birthDate,
		username: username,
		password: password
	}
}

// **********************************************************************
function signupHelper(req, res) {
	let params = loadBodyParams(req, res);
	if (!params) return;

	let filepath = req.file.path;
	fs.readFile(filepath, {encoding: 'base64'}, (err, data) => {
		if (err) {
			console.error("file reading error in addUserHandler function:");
            console.log(err);
            let result = {
                status: "fail",
                message: "something went wrong!"
            };
            res.status(500).send(JSON.stringify(result));
            return;
		}
		let today = DateTime.now().setZone(TIME_ZONE).toFormat('yyyy-MM-dd');
		client.db("test").collection("users").insertOne({
			level: 2,
			firstname: params.firstname,
			lastname: params.lastname,
			nationalID: params.nationalID,
			birthDate: params.birthDate,
			username: params.username,
			password: params.password,
			signupDate: today,
			profilePic: {
				data: data,
				contentType: req.file.mimetype
			}
		})
		.then (() => {
			let response = {
				status: "ok",
				message: "accepted!"
			}
			res.send(JSON.stringify(response));
			fs.unlink(filepath, (err) => {
				if (err) console.log(err);
			})
		})
		.catch((err) => {
			if (err) {
				let response = {
					status: "fail",
					message: "Something went wrong!"
				}
				res.status(500).send(JSON.stringify(response));
				console.log(err);
			}
		});
	})
}

// **********************************************************************
router.post('/api/signup', (req, res) => {
	let profileUpload = upload.single("profilePic");
	profileUpload(req, res, (err) => {
		if (err instanceof multer.MulterError) {
			let response = {
				status: "reject",
				message: "error loading profile pic!"
			}
			res.status(400).send(JSON.stringify(response));
		}
		else if (err) {
			console.error("file uploading error in signupHandler function:");
            console.log(err);
            let result = {
                status: "fail",
                message: "something went wrong!"
            };
            res.status(500).send(JSON.stringify(result));
		}
		else if (!req.file) {
			let response = {
				status: "reject",
				message: "couldn't load profile pic!"
			}
			res.status(400).send(JSON.stringify(response));
		}
		else {
			signupHelper(req, res);
		}
	});
});

// **********************************************************************
function loadEditParams(req, res) {
	let firstname = req.body.firstname;
	if (!firstname) return loadRejectHelper(res, "firstname");
	if (hasLengthError(firstname) || !/^[a-zA-Z\s]+$/g.test(firstname))
		return rejectHelper(res, "firtname");
	firstname = firstname.trim();
	
	let lastname = req.body.lastname;
	if (!lastname) return loadRejectHelper(res, "lastname");
	if (hasLengthError(lastname) || !/^[a-zA-Z\s]+$/g.test(lastname))
		return rejectHelper(res, "lastname");
	lastname = lastname.trim();
		
	let nationalID = req.body.nationalID;
	if (!nationalID) return loadRejectHelper(res, "nationalID");
	if (hasLengthError(nationalID, 10) || !/^[0-9]+$/g.test(nationalID))
		return rejectHelper(res, "nationalID");
	
	let birthDate = req.body.birthDate;
	if (!birthDate) return loadRejectHelper(res, "birthDate");
	if (birthDate.length != 10 || !isValidDate(birthDate))
		return rejectHelper(res, "birthDate");
		
	return {
		firstname: firstname.toLowerCase(),
		lastname: lastname.toLowerCase(),
		nationalID: nationalID,
		birthDate: birthDate,
		username: req.body.username,
	}
}

// **********************************************************************
function editUserHelper(req, res) {
	let params = loadEditParams(req, res);
	if (!params) return;

	let filter = { username: params.username };
	if (!req.file) {
		client.db("test").collection("users").updateOne(filter, {
			$set: {
				firstname: params.firstname,
				lastname: params.lastname,
				nationalID: params.nationalID,
				birthDate: params.birthDate,
			}
		})
		.then (() => {
			let response = {
				status: "ok",
				message: "accepted!"
			}
			res.send(JSON.stringify(response));
		})
		.catch((err) => {
			if (err) {
				let response = {
					status: "reject",
					message: "Bad Request!"
				}
				res.status(400).send(JSON.stringify(response));
				console.log(err);
			}
		});
		return;
	}

	let filepath = req.file.path;
	fs.readFile(filepath, {encoding: 'base64'}, (err, data) => {
		if (err) {
			console.error("file reading error in editUserHelper function:");
            console.log(err);
            let result = {
                status: "fail",
                message: "something went wrong!"
            };
            res.status(500).send(JSON.stringify(result));
            return;
		}
		client.db("test").collection("users").updateOne(filter, {
			$set: {
				firstname: params.firstname,
				lastname: params.lastname,
				nationalID: params.nationalID,
				birthDate: params.birthDate,
				profilePic: {
					data: data,
					contentType: req.file.mimetype
				}
			}
		})
		.then (() => {
			let response = {
				status: "ok",
				message: "accepted!"
			}
			res.send(JSON.stringify(response));
			fs.unlink(filepath, (err) => {
				if (err) console.log(err);
			})
		})
		.catch((err) => {
			let response = {
				status: "reject",
				message: "Bad Request!"
			}
			res.status(400).send(JSON.stringify(response));
			console.log(err);
		})
	})
}

// **********************************************************************
router.post('/api/edit-user', (req, res) => {
	let profileUpload = upload.single("profilePic");
	profileUpload(req, res, (err) => {
		if (err instanceof multer.MulterError) {
			let response = {
				status: "reject",
				message: "error loading profile pic!"
			}
			res.status(400).send(JSON.stringify(response));
		}
		else if (err) {
			console.error("file uploading error in signupHandler function:");
            console.log(err);
            let result = {
                status: "fail",
                message: "something went wrong!"
            };
            res.status(500).send(JSON.stringify(result));
		}
		else {
			editUserHelper(req, res);
		}
	});
});

module.exports.router = router;
