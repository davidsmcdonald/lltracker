const express = require('express');
const morgan = require('morgan');
const flash = require('express-flash');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const store = require('connect-loki');
const jwt = require('jsonwebtoken')
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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: '/',
    secure: false,
  },
  name: 'lltracker-session-id',
  resave: false,
  saveUninitialized: true,
  secret: 'Wellokifyousayso2020',
  store: new LokiStore({}),
}));

app.use(flash());

// Set up persistent session data
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

// Extract session info
app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

const requiresAuthentication = (req, res, next) => {
  if (!res.locals.signedIn) {
    res.redirect(302, "/demo/signin");
  } else {
    next();
  }
};

const requiresToken = (req, res, next) => {
  const authorizationHeader = req.headers.token;
  let result;
  if (authorizationHeader) {
    // const authToken = req.headers.token.split(' ')[1];
    const authToken = authorizationHeader;
    const options = {
      expiresIn: '31d',
      issuer: 'https://lltracker.herokuapp.com/'
    };
    try {
      result = jwt.verify(authToken, process.env.JWT_SECRET, options);
      req.decoded = result;
      next();
    } catch(err) {
      throw new Error(err);
    }
  } else {
    result = {
      error: 'Authentication Error. Token required',
      status: 401
    };
    res.status(401).send(result);
  }
}

// FOR MAIN WEBSITE

// Redirect home page
app.get('/', (req, res) => {
  res.redirect('/track');
});

// Home page - some about info, submit box for userid
app.get('/track',
  catchError(async (req, res) => {
    res.render('start');
  }));

app.get('/home',
  catchError(async (req, res) => {
    res.render('home');
  }));

// Queries for a particular user, renders tracking page
app.get('/finduser',
  catchError(async (req, res) => {
    let username = req.query.username;
    let data = await res.locals.store.allLocations(username);

    if (data) {
      res.render('tracking', {
        username: username,
        data: data
      });
    } else {
      req.flash("error", "User not found. Try again.");
      res.redirect('/home');
    }
  }));


// FOR DEMO >>>>

// Manual location add for demo
app.get('/demo/start',
  requiresAuthentication,
  catchError(async (req, res) => {
    res.render('addloc');
  })
);

// Render page for manual user add - demo
app.get('/demo/new',
  catchError(async (req, res) => {
    res.render('newuser');
  })
);

// Validate manual user add and redirect - demo
app.post("/demo/new",
  catchError(async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    let validUser = await res.locals.store.createUser(username, password);
    if (!validUser) {
      req.flash("error", "Username already exists. Please try again.");
      res.redirect("/demo/new");
    } else {
      req.session.username = username;
      req.session.signedIn = true;
      res.redirect('/demo/start');
      req.flash("info", `User ${username} created!`);
    }
  })
);

// Redirect to sign in form - demo
app.get('/demo/signin',
  catchError(async (req, res) => {
    res.render('signin', {
      flash: req.flash(),
    });
  })
);

// Validate sign in form - demo
app.post('/demo/validate',
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
      res.redirect('/demo/start');
      req.flash("info", `Welcome, ${username}!`);
    }
  })
);

app.post('/demo/addlocation',
  requiresAuthentication,
  catchError(async (req, res) => {
    let location = req.body;
    let lat = location.latitude;
    let lon = location.longitude;
    let username = req.session.username;
    let time = new Date();
    // formats date Object to SQL timestamp
    let sqlTime = time.toISOString().slice(0, 19).replace('T', ' ');
    let created = await res.locals.store.addLocationNoSession(lat, lon, sqlTime, username);
      if (!created) {
        req.flash("error", "Something went wrong.");
        res.redirect('/demo/start');
      } else {
        req.flash("info", "Location added.");
        res.redirect('/demo/start');
      }
  }));

app.post('/demo/signout',
  catchError(async (req, res) => {
    req.session.destroy(function(err) {
      res.redirect('/demo/signin');
    });
  }));

// Delete user location history
app.post('/destroy',
  requiresAuthentication,
  catchError(async (req, res) => {
    let deleted = await res.locals.store.deleteData();
    if (!deleted) {
      //do something
    } else {
      //success message
      //redirect somewhere
      res.redirect('/demo/start');
    }
  }));



// FOR APP >>>>>

// add a location
app.post('/addlocation',
  requiresToken,
  catchError(async (req, res) => {
    let location = req.body;
    let lat = location.latitude;
    let lon = location.longitude;
    let appTime = location.logtime;
    let username = location.username;
    // creates date object to format for SQL
    let time = new Date(appTime);
    // formats date Object to SQL timestamp
    let sqlTime = time.toISOString().slice(0, 19).replace('T', ' ');
    let created = await res.locals.store.addLocationNoSession(lat, lon, sqlTime, username);
      if (!created) {
        res.status(400).send('Not Created')
      } else {
        res.status(201).send({"username":`${username}`,"latitude":`${String(lat)}`,"longitude": `${String(lon)}`,"logtime":`${appTime}`});
      }
  }));


app.post("/signin",
  catchError(async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const result = {};
    let status = 200;

    let validUser = await res.locals.store.authenticate(username, password);
    if (!validUser) {
      status = 401;
      result.status = status;
      result.username = username;
      result.message = "Login failed, please try again.";
    } else {
      const payload = { user: username };
      const options = { expiresIn: '31d', issuer: 'https://lltracker.herokuapp.com/' };
      const secret = process.env.JWT_SECRET;
      const token = jwt.sign(payload, secret, options);

      result.token = token;
      result.status = status;
      result.username = username;
    }
    res.status(status).send(result);
  }));


  app.post('/adduser',
    catchError(async (req, res) => {
      const username = req.body.username.trim();
      const password = req.body.password.trim();
      const result = {};
      let status;

      if (username.length = 0 || password.length == 0) {
        status = 401;
        result.status = status;
        result.username = username;
        result.message = "A username and password are required. Please try again.";
      }

      let created = await res.locals.store.createUser(username, password);
        if (created == "duplicate") {
          status = 401;
          result.status = status;
          result.username = username;
          result.message = "Username already exists, please try again.";
        } else if (created) {
          const payload = { user: username };
          const options = { expiresIn: '31d', issuer: 'https://lltracker.herokuapp.com/' };
          const secret = process.env.JWT_SECRET;
          const token = jwt.sign(payload, secret, options);

          result.token = token;
          result.status = status;
          result.username = username;
        } else {
          status = 401;
          result.status = status;
          result.username = username;
          result.message = "Add user failed. Please try again."
        }
        res.status(status).send(result);
    }));

// Error handler
app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

// Listener
app.listen(port, host, () => {
  console.log(`LLtracker is listening on port ${port} of ${host}!`);
});
