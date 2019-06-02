import AppBar from '@material-ui/core/AppBar';
import Badge from '@material-ui/core/Badge';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Grid from '@material-ui/core/Grid';
import IconButton from '@material-ui/core/IconButton';
import IdleTimer from 'react-idle-timer';
import InputBase from '@material-ui/core/InputBase';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import MenuIcon from '@material-ui/icons/Menu';
import Paper from '@material-ui/core/Paper';
import PauseIcon from '@material-ui/icons/Pause';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import ReportIcon from '@material-ui/icons/Report';
import Snackbar from '@material-ui/core/Snackbar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import escapeHtml from 'escape-html';
import {Connection} from '@solana/web3.js';
import {fade} from '@material-ui/core/styles/colorManipulator';
import {withStyles} from '@material-ui/core/styles';

//import {sleep} from './util/sleep';
import {getFirstMessage, refreshMessageFeed, postMessage} from './message-feed';

const styles = theme => ({
  root: {
    width: '100%',
  },
  grow: {
    flexGrow: 1,
  },
  menuButton: {
    marginLeft: -12,
    marginRight: 20,
  },
  title: {
    display: 'none',
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  },
  badge: {
    padding: `0 ${theme.spacing.unit * 1.5}px`,
  },
  message: {
    ...theme.mixins.gutters(),
    paddingTop: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit * 2,
  },
  newmessage: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: fade(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: fade(theme.palette.common.white, 0.25),
    },
    marginRight: theme.spacing.unit * 2,
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing.unit * 3,
      width: '70%',
    },
  },
  login: {
    position: 'relative',
    marginLeft: theme.spacing.unit * 3,
    marginRight: theme.spacing.unit * 4,
  },
  inputRoot: {
    color: 'inherit',
    width: '100%',
  },
  inputInput: {
    paddingTop: theme.spacing.unit,
    paddingRight: theme.spacing.unit * 2,
    paddingBottom: theme.spacing.unit,
    paddingLeft: theme.spacing.unit * 2,
    transition: theme.transitions.create('width'),
    width: '100%',
  },
});

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      banUserDialogOpen: false,
      banUserMessage: null,
      busyLoading: true,
      busyPosting: false,
      idle: false,
      messages: [],
      newMessage: '',
      snackMessage: '',
      transactionSignature: null,
      userAuthenticated: false,
      loginMethod: 'none',
    };
    this.programId = null;
    this.postCount = 0;

    let configUrl = window.location.origin;
    if (window.location.hostname === 'localhost') {
      configUrl = 'http://localhost:8081';
    }
    configUrl += '/config.json';
    this.configUrl = configUrl;

    this.onActive();
  }

  busy() {
    return (
      (this.state.busyLoading || this.state.busyPosting) && !this.state.idle
    );
  }

  // Periodically polls for a new program id, which indicates either a cluster reset
  // or new message feed server deployment
  async pollForFirstMessage() {
    if (this.state.idle) {
      return;
    }

    console.log('pollForFirstMessage');
    try {
      let userAuthenticated = false;
      const {firstMessage, loginMethod, url, programId} = await getFirstMessage(
        this.configUrl,
      );
      if (loginMethod === 'none') {
        userAuthenticated = true;
      }
      if (this.programId !== programId) {
        this.connection = new Connection(url);
        this.connectionUrl = url;
        this.programId = programId;
        this.firstMessage = firstMessage;

        const matches = this.connectionUrl.match(
          'https://api.(.*)testnet.solana.com',
        );
        if (matches) {
          const testnet = matches[1];
          this.blockExplorerUrl = `http://${testnet}testnet.solana.com`;
        } else {
          this.blockExplorerUrl = 'http://localhost:3000';
        }

        this.setState({
          busyLoading: true,
          messages: [],
          loginMethod,
          userAuthenticated,
        });
      }
    } catch (err) {
      console.error(`pollForFirstMessage error: ${err}`);
    }
    setTimeout(() => this.pollForFirstMessage(), 10 * 1000);
  }

  // Refresh messages.
  // TODO: Rewrite this function to use the solana-web3.js websocket pubsub
  //       instead of polling
  async periodicRefresh() {
    if (this.state.idle) {
      return;
    }

    console.log('periodicRefresh');
    try {
      let {messages} = this.state;
      for (;;) {
        const {postCount} = this;
        await refreshMessageFeed(
          this.connection,
          messages,
          () => this.setState({messages}),
          messages.length === 0 ? this.firstMessage : null,
        );
        if (postCount === this.postCount) {
          break;
        }
        console.log('Post count increated, refreshing');
      }
      this.setState({busyLoading: false});
    } catch (err) {
      console.error(`periodicRefresh error: ${err}`);
    }

    setTimeout(
      () => this.periodicRefresh(),
      this.state.busyPosting ? 250 : 1000,
    );
  }

  render() {
    const {classes} = this.props;

    const messages = this.state.messages
      .map((message, i) => {
        return (
          <List key={i} className={classes.root}>
            <Paper className={classes.message}>
              <ListItem>
                <ListItemText
                  primary={escapeHtml(message.text)}
                  secondary={'Posted by ' + message.name}
                />
                <ListItemSecondaryAction>
                  {
                    this.state.loginMethod === 'none' || !this.state.userAuthenticated ? '' : (
                      <IconButton
                        edge="end"
                        aria-label="Report"
                        onClick={() => this.onBanUser(message)}
                      >
                        <ReportIcon />
                      </IconButton>
                    )
                  }
                </ListItemSecondaryAction>
              </ListItem>
            </Paper>
          </List>
        );
      })
      .reverse();

    let banUserDialog;
    if (this.state.banUserMessage !== null) {
      const user = this.state.banUserMessage.name;

      banUserDialog = (
        <Dialog
          open={this.state.banUserDialogOpen}
          onClose={this.onBanUserDialogClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{`Ban ${user}`}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              Do you want to prohibit <b>{user}</b> from posting messages?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.onBanUserDialogClose} color="primary">
              Cancel
            </Button>
            <Button
              onClick={this.onBanUserDialogConfirm}
              color="primary"
              autoFocus
            >
              Ban User
            </Button>
          </DialogActions>
        </Dialog>
      );
    }

    let newMessage;
    if (this.state.userAuthenticated) {
      newMessage = (
        <div className={classes.newmessage}>
          <InputBase
            placeholder="Say something nice…"
            value={this.state.newMessage}
            classes={{
              root: classes.inputRoot,
              input: classes.inputInput,
            }}
            onKeyDown={this.onInputKeyDown}
            onChange={this.onInputChange}
          />
        </div>
      );
    } else {
      if (this.state.loginMethod !== 'none') {
        newMessage = (
          <div className={classes.login}>
            <Button variant="contained" color="default" onClick={this.onLogin}>
              Login to start posting
            </Button>
          </div>
        );
      }
    }

    return (
      <div className={classes.root}>
        <AppBar position="static">
          <Toolbar>
            <IconButton
              disabled={!this.blockExplorerUrl}
              onClick={this.onBlockExplorerTransactionsByProgram}
              className={classes.menuButton}
              color="inherit"
              aria-label="Block explorer"
            >
              <MenuIcon />
            </IconButton>
            <Badge
              className={classes.badge}
              color="secondary"
              badgeContent={this.state.messages.length}
            >
              <Typography
                className={classes.title}
                variant="h6"
                color="inherit"
                noWrap
              >
                Message Feed
              </Typography>
            </Badge>
            {newMessage}
            {this.state.idle ? <PauseIcon /> : ''}
            {this.busy() ? (
              <CircularProgress className={classes.progress} color="inherit" />
            ) : (
              ''
            )}
            <div className={classes.grow} />
          </Toolbar>
        </AppBar>
        <IdleTimer
          element={document}
          onActive={this.onActive}
          onIdle={this.onIdle}
          debounce={250}
          timeout={1000 * 60 * 15}
        />
        <Grid item xs>
          {messages}
        </Grid>
        <Snackbar
          open={this.state.snackMessage !== ''}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          autoHideDuration={6000}
          onClose={this.onSnackClose}
          ContentProps={{
            'aria-describedby': 'message-id',
          }}
          message={<span id="message-id">{this.state.snackMessage}</span>}
          action={
            this.state.transactionSignature ? (
              <Button
                color="secondary"
                size="small"
                onClick={this.onBlockExplorerLatestTransaction}
              >
                Transaction Details
              </Button>
            ) : (
              ''
            )
          }
        />
        {banUserDialog}
      </div>
    );
  }

  async postMessage() {
    if (this.state.newMessage.length === 0) {
      return;
    }

    if (this.state.busyPosting) {
      this.setState({
        snackMessage: 'Unable to post message, please retry when not busy',
        transactionSignature: null,
      });
      return;
    }
    this.setState({busyPosting: true});
    const {messages, newMessage} = this.state;
    try {
      const transactionSignature = await postMessage(
        this.connection,
        newMessage,
        messages[messages.length - 1].publicKey,
      );
      this.postCount++;
      this.setState({
        snackMessage: 'Message posted',
        transactionSignature,
        newMessage: '',
      });
    } catch (err) {
      console.error(`Failed to post message: ${err}`);
      this.setState({
        snackMessage: 'An error occured when posting the message',
      });
    }
    this.setState({busyPosting: false});
  }

  onInputKeyDown = e => {
    if (e.keyCode !== 13) {
      return;
    }
    this.postMessage();
  };

  onInputChange = e => {
    this.setState({newMessage: e.target.value});
  };

  onSnackClose = () => {
    this.setState({
      snackMessage: '',
      transactionSignature: null,
    });
  };

  onActive = () => {
    console.log('user is active');
    this.setState({idle: false});
    this.pollForFirstMessage();
    this.periodicRefresh();
  };

  onIdle = () => {
    console.log('user is idle');
    this.setState({idle: true});
  };

  onLogin = () => {
    switch (this.state.loginMethod) {
      case 'google':
        throw new Error(
          `TODO unimplemented login method: ${this.state.loginMethod}`,
        );
      case 'local':
        this.setState({userAuthenticated: true});
        break;
      default:
        throw new Error(`Unsupported login method: ${this.state.loginMethod}`);
    }
  };

  onBanUser = message => {
    this.setState({
      banUserDialogOpen: true,
      banUserMessage: message,
    });
  };

  onBanUserDialogClose = () => {
    this.setState({
      banUserDialogOpen: false,
      banUserMessage: null,
    });
  };

  onBanUserDialogConfirm = () => {
    console.log('Ban', this.state.banUserMessage);
    this.onBanUserDialogClose();
  };

  onBlockExplorerTransactionsByProgram = () => {
    if (!this.blockExplorerUrl) return;
    window.open(`${this.blockExplorerUrl}/txns-by-prgid/${this.programId}`);
  };

  onBlockExplorerLatestTransaction = () => {
    if (!this.blockExplorerUrl) return;
    if (this.state.transactionSignature === null) return;
    window.open(
      `${this.blockExplorerUrl}/txn/${this.state.transactionSignature}`,
    );
  };
}
App.propTypes = {
  classes: PropTypes.object.isRequired,
};

const StyledApp = withStyles(styles)(App);
ReactDOM.render(<StyledApp />, document.getElementById('app'));
module.hot.accept();
