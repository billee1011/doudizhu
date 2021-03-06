PG.createPlay = function (seat, game) {
    var player = seat == 0 ? new PG.Player(seat, game) : new PG.NetPlayer(seat, game);
    var xy = [
        PG.PW / 2, game.world.height - PG.PH - 10,
        game.world.width - PG.PW / 2, 94,
        PG.PW / 2, 94
    ];
    player.initUI(xy[seat * 2], xy[seat * 2 + 1]);
    if (seat == 0) {
       player.initShotGroup();
    } else if (seat == 1) {
        player.uiHead.scale.set(-1, 1);
    }
    return player;
};

PG.Player = function (seat, game) {
    this.uid = seat;
    this.seat = seat;
    this.game = game;

    this.pokerInHand = [];
    this._pokerPic = {};
    this.isLandlord = false;

    this.hintPoker = [];
    this.isDraging = false;
};

PG.Player.prototype.initUI = function (sx, sy) {
    this.uiHead = this.game.add.sprite(sx, sy, 'btn', 'icon_default.png');
    this.uiHead.anchor.set(0.5, 1);
};

PG.Player.prototype.updateInfo = function(uid, name) {
    this.uid = uid;
    if (uid == -1) {
        this.uiHead.frameName = 'icon_default.png';
    } else {
        this.uiHead.frameName = 'icon_farmer.png';
    }
};

PG.Player.prototype.initShotGroup = function() {
    this.uiShotBtn = this.game.add.group();
    var group = this.uiShotBtn;

    var sy =  this.game.world.height * 0.6;
    var pass = this.game.add.button(0, sy, "btn", this.onPass, this, 'pass.png', 'pass.png', 'pass.png');
    pass.anchor.set(0.5, 0);
    group.add(pass);
    var hint = this.game.add.button(0, sy, "btn", this.onHint, this, 'hint.png', 'hint.png', 'hint.png');
    hint.anchor.set(0.5, 0);
    group.add(hint);
    var shot = this.game.add.button(0, sy, "btn", this.onShot, this, 'shot.png', 'shot.png', 'shot.png');
    shot.anchor.set(0.5, 0);
    group.add(shot);

    group.forEach(function(child){ child.kill(); });
};

PG.Player.prototype.setLandlord = function () {
    this.isLandlord = true;
    this.uiHead.frameName = 'icon_landlord.png';
};

PG.Player.prototype.say = function (str) {

    var style = {font: "22px Arial", fill: "#ffffff", align: "center"};
    var sx = this.uiHead.x + this.uiHead.width/2 + 10;
    var sy = this.uiHead.y - this.uiHead.height * 0.5;
    var text = this.game.add.text(sx, sy, str, style);
    if (this.uiHead.scale.x == -1) {
        text.x = text.x - text.width - 10;
    }
    this.game.time.events.add(2000, text.destroy, text);
};

PG.Player.prototype.onInputDown = function (poker, pointer) {
    this.isDraging = true;
    this.onSelectPoker(poker, pointer);
};

PG.Player.prototype.onInputUp = function (poker, pointer) {
    this.isDraging = false;
    //this.onSelectPoker(poker, pointer);
};

PG.Player.prototype.onInputOver = function (poker, pointer) {
    if (this.isDraging) {
        this.onSelectPoker(poker, pointer);
    }
};

PG.Player.prototype.onSelectPoker = function (poker, pointer) {
    var index = this.hintPoker.indexOf(poker.id);
    if (index == -1) {
        poker.y = this.game.world.height - PG.PH * 0.8;
        this.hintPoker.push(poker.id);
    } else {
        poker.y = this.game.world.height - PG.PH * 0.5;
        this.hintPoker.splice(index, 1);
    }
};

PG.Player.prototype.onPass = function (btn) {
    this.game.finishPlay([]);
    this.pokerUnSelected(this.hintPoker);
    this.hintPoker = [];
    btn.parent.forEach(function (child) {
        child.kill();
    });
};

PG.Player.prototype.onHint = function (btn) {
    if (this.hintPoker.length == 0) {
        this.hintPoker = this.lastTurnPoker;
    } else {
        this.pokerUnSelected(this.hintPoker);
        if (!PG.Poker.canCompare(this.hintPoker, this.lastTurnPoker)) {
            this.hintPoker = [];
        }
    }
    var bigger = this.hint(this.hintPoker);
    if (bigger.length == 0) {
        if (this.hintPoker == this.lastTurnPoker) {
            this.say("没有能大过的牌");
        } else {
            this.pokerUnSelected(this.hintPoker);
        }
    } else {
        this.pokerSelected(bigger);
    }
    this.hintPoker = bigger;
};

PG.Player.prototype.onShot = function (btn) {
    if (this.hintPoker.length == 0) {
        return;
    }
    var code = this.canPlay(this.game.isLastShotPlayer() ? [] : this.game.tablePoker, this.hintPoker);
    if (code == -1) {
        this.say("出牌不符合规矩");
        return;
    }
    if (code == 0) {
        this.say("出牌必须大于上家的牌");
        return;
    }
    this.game.finishPlay(this.hintPoker);
    this.hintPoker = [];
    btn.parent.forEach(function (child) {
        child.kill();
    });
};


PG.Player.prototype.hint = function (lastTurnPoker) {
    var cards;
    var handCards = PG.Poker.toCards(this.pokerInHand);
    if (lastTurnPoker.length === 0) {
        cards = PG.Rule.bestShot(handCards);
    } else {
        cards = PG.Rule.cardsAbove(handCards, PG.Poker.toCards(lastTurnPoker));
    }

    return PG.Poker.toPokers(this.pokerInHand, cards);
};

PG.Player.prototype.canPlay = function (lastTurnPoker, shotPoker) {
    var cardsA = PG.Poker.toCards(shotPoker);
    var cardsB = PG.Poker.toCards(lastTurnPoker);
    var code = PG.Rule.compare(cardsA, cardsB);
    if (code === -10000)
        return -1;
    if (code > 0)
        return 1;
    return 0;
};

PG.Player.prototype.playPoker = function(lastTurnPoker) {
    this.lastTurnPoker = lastTurnPoker;

    var group = this.uiShotBtn;
    var step = this.game.world.width/6;
    var sx = this.game.world.width/2 - 0.5 * step;
    if (!this.game.isLastShotPlayer()) {
        sx -= 0.5 * step;
        var pass = group.getAt(0);
        pass.centerX = sx;
        sx += step;
        pass.revive();
    }
    var hint = group.getAt(1);
    hint.centerX = sx;
    hint.revive();
    var shot = group.getAt(2);
    shot.centerX = sx + step;
    shot.revive();

    this.enableInput();
};

PG.Player.prototype.sortPoker = function () {
    this.pokerInHand.sort(PG.Poker.comparePoker);
};

PG.Player.prototype.pushAPoker = function (poker) {
    this._pokerPic[poker.id] = poker;

    poker.events.onInputDown.add(this.onInputDown, this);
    poker.events.onInputUp.add(this.onInputUp, this);
    poker.events.onInputOver.add(this.onInputOver, this);

};

PG.Player.prototype.removeAPoker = function (pid) {
    var length = this.pokerInHand.length;
    for (var i = 0; i < length; i++) {
        if (this.pokerInHand[i] === pid) {
            this.pokerInHand.splice(i, 1);
            delete this._pokerPic[pid];
            return true;
        }
    }
    console.log('Error: REMOVE POKER ', pid);
    return false;
};

PG.Player.prototype.findAPoker = function (pid) {
    var poker = this._pokerPic[pid];
    if (poker === undefined) {
        console.log('Error: FIND POKER ', pid);
    }
    return poker;
};

PG.Player.prototype.enableInput = function () {
    var length = this.pokerInHand.length;
    for (var i = 0; i < length; i++) {
        var p = this.findAPoker(this.pokerInHand[i]);
        p.inputEnabled = true;
    }
};

PG.Player.prototype.pokerSelected = function (pokers) {
    for (var i = 0; i < pokers.length; i++) {
        var p = this.findAPoker(pokers[i]);
        p.y = this.game.world.height - PG.PH * 0.8;
    }
};

PG.Player.prototype.pokerUnSelected = function (pokers) {
    for (var i = 0; i < pokers.length; i++) {
        var p = this.findAPoker(pokers[i]);
        p.y = this.game.world.height - PG.PH / 2;
    }
};

