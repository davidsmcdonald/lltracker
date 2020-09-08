const express = require('express');
const morgan = require('morgan');
const flash = require('express-flash');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const store = require('connect-loki');
const config = require('./lib/config');
const PgPersistence = require('./lib/pg-persistence');
const catchError = require('./lib/catch-error');

const app = express();
const host = config.HOST;
const port = config.PORT;
const LokiStore = store(session);

app.set('views', './views');
app.set('view engine', 'pug');

app.use(morgan('common'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: '/',
    secure: false,
  },
  name: 'whereiam-session-id',
  resave: false,
  saveUninitialized: true,
  secret: 'Fastbananamonkey1969',
  store: new LokiStore({}),
}));

const requiresAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    res.redirect(302, "/test/signin");
  } else {
    next();
  }
};

// Redirect home page
app.get('/', (req, res) => {
  res.redirect('/home');
});

// **ONLY FOR WEBSITE TESTING NOT APP**
app.get('/test/start',
  requiresAuthentication,
  catchError(async (req, res) => {
    res.render('addloc');
  })
);

// **ONLY FOR WEBSITE TESTING NOT APP**
app.get('/test/new',
  catchError(async (req, res) => {
    res.render('newuser');
  })
);

// **ONLY FOR WEBSITE TESTING NOT APP**
// New user
app.post("/test/new",
  catchError(async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    let validUser = await res.locals.store.createUser(username, password);
    if (!validUser) {
      req.flash("error", "", {
      // some sort of error message and reload
        flash: req.flash(),
        username: req.body.username,
      });
    } else {
      req.session.username = username;
      req.session.signedIn = true;
      res.redirect('/addloc');
      req.flash("info", "Welcome!");
    }
  })
);

// **ONLY FOR WEBSITE TESTING NOT APP**
// Sign in
app.post('/test/signin',
  catchError(async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    let validUser = await res.locals.store.authenticate(username, password);
    if (!validUser) {
      req.flash("error", "Invalid credentials.");
      res.render('signin', {
        flash: req.flash(),
        username: req.body.username,
      });
    } else {
      req.session.username = username;
      req.session.signedIn = true;
      res.redirect('/addloc')
      req.flash("info", "Welcome!");
    }
  })
);

//** needs modification for app
// Post location
app.post('/location',
  requiresAuthentication,
  catchError(async (req, res) => {
    let errors = validationResult(req);
    let lat = req.body.latitude;
    let lon = req.body.longitude;
    // set time from server
    // let time = req.body.timestamp;
    // only sets server time (app should generate local time)
    let time = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let created = await res.locals.store.addDataPoint(lat, lon, time);
      if (!created) {
        // add some arbitrary null/data value to table
      }
  }));

// delete history
app.post('/destroy',
  requiresAuthentication,
  catchError(async (req, res) => {
    let deleted = await res.locals.store.deleteData();
    if (!deleted) {
      //do something
    } else {
      //success message
      //redirect somewhere
      res.redirect('/start');
    }
  }));

// Home page - some about info, submit box for userid
app.get('/home',
  catchError(async (req, res) => {
    res.render('home');
  }));

// Queries for a particular user, renders tracking page
app.get('/userid',
  catchError(async (req, res) => {
    let data = await res.locals.store.allLocations();
    res.render('tracking', {
      data: data
    });
  }));

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`WhereIAm is listening on port ${port} of ${host}!`);
});
