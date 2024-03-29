const path = require('path');
const express = require('express');
const client = require('./database.js').client;

const router = express.Router();

// **********************************************************************
// clear the residual sessions from the previous execution
client.db("test").collection("sessions").drop((err, delOK) => {
	if (err) {
		if (err.code == 26) {
			console.log("sessions collection not found! (already cleared)");
		}
		else console.log(err);
	}
	else if (delOK) {
		console.log("sessions collection deleted!");
	}

	console.log('listing database collections:')
	client.db("test").listCollections().toArray(function(err, collections) {
		if (err) {
			console.log(err);
			return;
		}
		for (let i = 0; i < collections.length; i++) {
			console.log(`  ${i}-`, collections[i].name)
		}
	});
});

// **********************************************************************
router.use('/', express.static(path.join(process.env.FRONT_PATH, 'public')));
router.use(require("./auth.js").router);

router.use('/assets/', express.static(
	path.join(process.env.FRONT_PATH, 'private', 'assets')
));
router.get('/sidebar-menu.js', (req, res) => {
	res.sendFile(path.join(process.env.FRONT_PATH, 'components', 'sidebar', 'sidebar-menu.js'));
});
router.get('/message.js', (req, res) => {
	res.sendFile(path.join(process.env.FRONT_PATH, 'components', 'message', 'message.js'));
});

const admin = require("./admin/router.js").router;
const user = require("./user/router.js").router;
router.use((req, res, next) => {
	if (req.user.level == 1) {
		admin(req, res, next);
	}
	else {
		user(req, res, next);
	}
});

// **********************************************************************
module.exports = router;
