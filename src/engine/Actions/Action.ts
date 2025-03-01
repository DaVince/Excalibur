import { RotationType } from './RotationType';

import { Actor } from '../Actor';
import { vec, Vector } from '../Algebra';
import { Logger } from '../Util/Log';
import * as Util from '../Util/Util';
import { obsolete } from '../Util/Decorators';

/**
 * Used for implementing actions for the [[ActionContext|Action API]].
 */
export interface Action {
  update(delta: number): void;
  isComplete(actor: Actor): boolean;
  reset(): void;
  stop(): void;
}

export class EaseTo implements Action {
  private _currentLerpTime: number = 0;
  private _lerpDuration: number = 1 * 1000; // 1 second
  private _lerpStart: Vector = new Vector(0, 0);
  private _lerpEnd: Vector = new Vector(0, 0);
  private _initialized: boolean = false;
  private _stopped: boolean = false;
  private _distance: number = 0;
  constructor(
    public actor: Actor,
    x: number,
    y: number,
    duration: number,
    public easingFcn: (currentTime: number, startValue: number, endValue: number, duration: number) => number
  ) {
    this._lerpDuration = duration;
    this._lerpEnd = new Vector(x, y);
  }
  private _initialize() {
    this._lerpStart = new Vector(this.actor.pos.x, this.actor.pos.y);
    this._currentLerpTime = 0;
    this._distance = this._lerpStart.distance(this._lerpEnd);
  }

  public update(delta: number): void {
    if (!this._initialized) {
      this._initialize();
      this._initialized = true;
    }

    // Need to update lerp time first, otherwise the first update will always be zero
    this._currentLerpTime += delta;
    let newX = this.actor.pos.x;
    let newY = this.actor.pos.y;
    if (this._currentLerpTime < this._lerpDuration) {
      if (this._lerpEnd.x < this._lerpStart.x) {
        newX =
          this._lerpStart.x -
          (this.easingFcn(this._currentLerpTime, this._lerpEnd.x, this._lerpStart.x, this._lerpDuration) - this._lerpEnd.x);
      } else {
        newX = this.easingFcn(this._currentLerpTime, this._lerpStart.x, this._lerpEnd.x, this._lerpDuration);
      }

      if (this._lerpEnd.y < this._lerpStart.y) {
        newY =
          this._lerpStart.y -
          (this.easingFcn(this._currentLerpTime, this._lerpEnd.y, this._lerpStart.y, this._lerpDuration) - this._lerpEnd.y);
      } else {
        newY = this.easingFcn(this._currentLerpTime, this._lerpStart.y, this._lerpEnd.y, this._lerpDuration);
      }
      // Given the lerp position figure out the velocity in pixels per second
      this.actor.vel = vec((newX - this.actor.pos.x) / (delta / 1000), (newY - this.actor.pos.y) / (delta / 1000));
    } else {
      this.actor.pos = vec(this._lerpEnd.x, this._lerpEnd.y);
      this.actor.vel = Vector.Zero;
    }
  }
  public isComplete(actor: Actor): boolean {
    return this._stopped || new Vector(actor.pos.x, actor.pos.y).distance(this._lerpStart) >= this._distance;
  }

  public reset(): void {
    this._initialized = false;
  }
  public stop(): void {
    this.actor.vel = vec(0, 0);
    this._stopped = true;
  }
}

export class MoveTo implements Action {
  private _actor: Actor;
  public x: number;
  public y: number;
  private _start: Vector;
  private _end: Vector;
  private _dir: Vector;
  private _speed: number;
  private _distance: number;
  private _started = false;
  private _stopped = false;
  constructor(actor: Actor, destx: number, desty: number, speed: number) {
    this._actor = actor;
    this._end = new Vector(destx, desty);
    this._speed = speed;
  }

  public update(_delta: number): void {
    if (!this._started) {
      this._started = true;
      this._start = new Vector(this._actor.pos.x, this._actor.pos.y);
      this._distance = this._start.distance(this._end);
      this._dir = this._end.sub(this._start).normalize();
    }
    const m = this._dir.scale(this._speed);
    this._actor.vel = vec(m.x, m.y);

    if (this.isComplete(this._actor)) {
      this._actor.pos = vec(this._end.x, this._end.y);
      this._actor.vel = vec(0, 0);
    }
  }

  public isComplete(actor: Actor): boolean {
    return this._stopped || new Vector(actor.pos.x, actor.pos.y).distance(this._start) >= this._distance;
  }

  public stop(): void {
    this._actor.vel = vec(0, 0);
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

export class MoveBy implements Action {
  private _actor: Actor;
  public x: number;
  public y: number;
  private _distance: number;
  private _speed: number;

  private _start: Vector;
  private _offset: Vector;
  private _end: Vector;
  private _dir: Vector;
  private _started = false;
  private _stopped = false;

  constructor(actor: Actor, offsetX: number, offsetY: number, speed: number) {
    this._actor = actor;
    this._speed = speed;
    this._offset = new Vector(offsetX, offsetY);
    if (speed <= 0) {
      Logger.getInstance().error('Attempted to moveBy with speed less than or equal to zero : ' + speed);
      throw new Error('Speed must be greater than 0 pixels per second');
    }
  }

  public update(_delta: number) {
    if (!this._started) {
      this._started = true;
      this._start = new Vector(this._actor.pos.x, this._actor.pos.y);
      this._end = this._start.add(this._offset);
      this._distance = this._offset.size;
      this._dir = this._end.sub(this._start).normalize();
    }

    this._actor.vel = this._dir.scale(this._speed);

    if (this.isComplete(this._actor)) {
      this._actor.pos = vec(this._end.x, this._end.y);
      this._actor.vel = vec(0, 0);
    }
  }

  public isComplete(actor: Actor): boolean {
    return this._stopped || actor.pos.distance(this._start) >= this._distance;
  }

  public stop(): void {
    this._actor.vel = vec(0, 0);
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

export class Follow implements Action {
  private _actor: Actor;
  private _actorToFollow: Actor;
  public x: number;
  public y: number;
  private _current: Vector;
  private _end: Vector;
  private _dir: Vector;
  private _speed: number;
  private _maximumDistance: number;
  private _distanceBetween: number;
  private _started = false;
  private _stopped = false;

  constructor(actor: Actor, actorToFollow: Actor, followDistance?: number) {
    this._actor = actor;
    this._actorToFollow = actorToFollow;
    this._current = new Vector(this._actor.pos.x, this._actor.pos.y);
    this._end = new Vector(actorToFollow.pos.x, actorToFollow.pos.y);
    this._maximumDistance = followDistance !== undefined ? followDistance : this._current.distance(this._end);
    this._speed = 0;
  }

  public update(_delta: number): void {
    if (!this._started) {
      this._started = true;
      this._distanceBetween = this._current.distance(this._end);
      this._dir = this._end.sub(this._current).normalize();
    }

    const actorToFollowSpeed = Math.sqrt(Math.pow(this._actorToFollow.vel.x, 2) + Math.pow(this._actorToFollow.vel.y, 2));
    if (actorToFollowSpeed !== 0) {
      this._speed = actorToFollowSpeed;
    }
    this._current = vec(this._actor.pos.x, this._actor.pos.y);

    this._end = vec(this._actorToFollow.pos.x, this._actorToFollow.pos.y);
    this._distanceBetween = this._current.distance(this._end);
    this._dir = this._end.sub(this._current).normalize();

    if (this._distanceBetween >= this._maximumDistance) {
      const m = this._dir.scale(this._speed);
      this._actor.vel = vec(m.x, m.y);
    } else {
      this._actor.vel = vec(0, 0);
    }

    if (this.isComplete()) {
      this._actor.pos = vec(this._end.x, this._end.y);
      this._actor.vel = vec(0, 0);
    }
  }

  public stop(): void {
    this._actor.vel = vec(0, 0);
    this._stopped = true;
  }

  public isComplete(): boolean {
    // the actor following should never stop unless specified to do so
    return this._stopped;
  }

  public reset(): void {
    this._started = false;
  }
}

export class Meet implements Action {
  private _actor: Actor;
  private _actorToMeet: Actor;
  public x: number;
  public y: number;
  private _current: Vector;
  private _end: Vector;
  private _dir: Vector;
  private _speed: number;
  private _distanceBetween: number;
  private _started = false;
  private _stopped = false;
  private _speedWasSpecified = false;

  constructor(actor: Actor, actorToMeet: Actor, speed?: number) {
    this._actor = actor;
    this._actorToMeet = actorToMeet;
    this._current = new Vector(this._actor.pos.x, this._actor.pos.y);
    this._end = new Vector(actorToMeet.pos.x, actorToMeet.pos.y);
    this._speed = speed || 0;

    if (speed !== undefined) {
      this._speedWasSpecified = true;
    }
  }

  public update(_delta: number): void {
    if (!this._started) {
      this._started = true;
      this._distanceBetween = this._current.distance(this._end);
      this._dir = this._end.sub(this._current).normalize();
    }

    const actorToMeetSpeed = Math.sqrt(Math.pow(this._actorToMeet.vel.x, 2) + Math.pow(this._actorToMeet.vel.y, 2));
    if (actorToMeetSpeed !== 0 && !this._speedWasSpecified) {
      this._speed = actorToMeetSpeed;
    }
    this._current = vec(this._actor.pos.x, this._actor.pos.y);

    this._end = vec(this._actorToMeet.pos.x, this._actorToMeet.pos.y);
    this._distanceBetween = this._current.distance(this._end);
    this._dir = this._end.sub(this._current).normalize();

    const m = this._dir.scale(this._speed);
    this._actor.vel = vec(m.x, m.y);

    if (this.isComplete()) {
      this._actor.pos = vec(this._end.x, this._end.y);
      this._actor.vel = vec(0, 0);
    }
  }

  public isComplete(): boolean {
    return this._stopped || this._distanceBetween <= 1;
  }

  public stop(): void {
    this._actor.vel = vec(0, 0);
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

export class RotateTo implements Action {
  private _actor: Actor;
  public x: number;
  public y: number;
  private _start: number;
  private _end: number;
  private _speed: number;
  private _rotationType: RotationType;
  private _direction: number;
  private _distance: number;
  private _shortDistance: number;
  private _longDistance: number;
  private _shortestPathIsPositive: boolean;
  private _currentNonCannonAngle: number;
  private _started = false;
  private _stopped = false;
  constructor(actor: Actor, angleRadians: number, speed: number, rotationType?: RotationType) {
    this._actor = actor;
    this._end = angleRadians;
    this._speed = speed;
    this._rotationType = rotationType || RotationType.ShortestPath;
  }

  public update(_delta: number): void {
    if (!this._started) {
      this._started = true;
      this._start = this._actor.rotation;
      this._currentNonCannonAngle = this._actor.rotation;
      const distance1 = Math.abs(this._end - this._start);
      const distance2 = Util.TwoPI - distance1;
      if (distance1 > distance2) {
        this._shortDistance = distance2;
        this._longDistance = distance1;
      } else {
        this._shortDistance = distance1;
        this._longDistance = distance2;
      }

      this._shortestPathIsPositive = (this._start - this._end + Util.TwoPI) % Util.TwoPI >= Math.PI;

      switch (this._rotationType) {
        case RotationType.ShortestPath:
          this._distance = this._shortDistance;
          if (this._shortestPathIsPositive) {
            this._direction = 1;
          } else {
            this._direction = -1;
          }
          break;
        case RotationType.LongestPath:
          this._distance = this._longDistance;
          if (this._shortestPathIsPositive) {
            this._direction = -1;
          } else {
            this._direction = 1;
          }
          break;
        case RotationType.Clockwise:
          this._direction = 1;
          if (this._shortestPathIsPositive) {
            this._distance = this._shortDistance;
          } else {
            this._distance = this._longDistance;
          }
          break;
        case RotationType.CounterClockwise:
          this._direction = -1;
          if (!this._shortestPathIsPositive) {
            this._distance = this._shortDistance;
          } else {
            this._distance = this._longDistance;
          }
          break;
      }
    }

    this._actor.rx = this._direction * this._speed;
    this._currentNonCannonAngle += (this._direction * this._speed) * (_delta / 1000);

    if (this.isComplete()) {
      this._actor.rotation = this._end;
      this._actor.rx = 0;
      this._stopped = true;
    }
  }

  public isComplete(): boolean {
    const distanceTravelled = Math.abs(this._currentNonCannonAngle - this._start);
    return this._stopped || distanceTravelled >= Math.abs(this._distance);
  }

  public stop(): void {
    this._actor.rx = 0;
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

export class RotateBy implements Action {
  private _actor: Actor;
  public x: number;
  public y: number;
  private _start: number;
  private _end: number;
  private _speed: number;
  private _offset: number;

  private _rotationType: RotationType;
  private _direction: number;
  private _distance: number;
  private _shortDistance: number;
  private _longDistance: number;
  private _shortestPathIsPositive: boolean;
  private _currentNonCannonAngle: number;
  private _started = false;
  private _stopped = false;
  constructor(actor: Actor, angleRadiansOffset: number, speed: number, rotationType?: RotationType) {
    this._actor = actor;
    this._speed = speed;
    this._offset = angleRadiansOffset;
    this._rotationType = rotationType || RotationType.ShortestPath;
  }

  public update(_delta: number): void {
    if (!this._started) {
      this._started = true;
      this._start = this._actor.rotation;
      this._currentNonCannonAngle = this._actor.rotation;
      this._end = this._start + this._offset;

      const distance1 = Math.abs(this._end - this._start);
      const distance2 = Util.TwoPI - distance1;
      if (distance1 > distance2) {
        this._shortDistance = distance2;
        this._longDistance = distance1;
      } else {
        this._shortDistance = distance1;
        this._longDistance = distance2;
      }

      this._shortestPathIsPositive = (this._start - this._end + Util.TwoPI) % Util.TwoPI >= Math.PI;

      switch (this._rotationType) {
        case RotationType.ShortestPath:
          this._distance = this._shortDistance;
          if (this._shortestPathIsPositive) {
            this._direction = 1;
          } else {
            this._direction = -1;
          }
          break;
        case RotationType.LongestPath:
          this._distance = this._longDistance;
          if (this._shortestPathIsPositive) {
            this._direction = -1;
          } else {
            this._direction = 1;
          }
          break;
        case RotationType.Clockwise:
          this._direction = 1;
          if (this._shortDistance >= 0) {
            this._distance = this._shortDistance;
          } else {
            this._distance = this._longDistance;
          }
          break;
        case RotationType.CounterClockwise:
          this._direction = -1;
          if (this._shortDistance <= 0) {
            this._distance = this._shortDistance;
          } else {
            this._distance = this._longDistance;
          }
          break;
      }
    }

    this._actor.rx = this._direction * this._speed;
    this._currentNonCannonAngle += (this._direction * this._speed) * (_delta / 1000);

    if (this.isComplete()) {
      this._actor.rotation = this._end;
      this._actor.rx = 0;
      this._stopped = true;
    }
  }

  public isComplete(): boolean {
    const distanceTravelled = Math.abs(this._currentNonCannonAngle - this._start);
    return this._stopped || distanceTravelled >= Math.abs(this._distance);
  }

  public stop(): void {
    this._actor.rx = 0;
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

@obsolete({ message: 'ex.Action.ScaleTo will be removed in v0.25.0', alternateMethod: 'Set width and hight directly' })
export class ScaleTo implements Action {
  private _actor: Actor;
  public x: number;
  public y: number;
  private _startX: number;
  private _startY: number;
  private _endX: number;
  private _endY: number;
  private _speedX: number;
  private _speedY: number;
  private _distanceX: number;
  private _distanceY: number;
  private _started = false;
  private _stopped = false;
  constructor(actor: Actor, scaleX: number, scaleY: number, speedX: number, speedY: number) {
    this._actor = actor;
    this._endX = scaleX;
    this._endY = scaleY;
    this._speedX = speedX;
    this._speedY = speedY;
  }

  public update(_delta: number): void {
    if (!this._started) {
      this._started = true;
      this._startX = this._actor.scale.x;
      this._startY = this._actor.scale.y;
      this._distanceX = Math.abs(this._endX - this._startX);
      this._distanceY = Math.abs(this._endY - this._startY);
    }

    if (!(Math.abs(this._actor.scale.x - this._startX) >= this._distanceX)) {
      const directionX = this._endY < this._startY ? -1 : 1;
      this._actor.sx = this._speedX * directionX;
    } else {
      this._actor.sx = 0;
    }

    if (!(Math.abs(this._actor.scale.y - this._startY) >= this._distanceY)) {
      const directionY = this._endY < this._startY ? -1 : 1;
      this._actor.sy = this._speedY * directionY;
    } else {
      this._actor.sy = 0;
    }

    if (this.isComplete()) {
      this._actor.scale = vec(this._endX, this._endY);
      this._actor.sx = 0;
      this._actor.sy = 0;
    }
  }

  public isComplete(): boolean {
    return (
      this._stopped ||
      (Math.abs(this._actor.scale.y - this._startX) >= this._distanceX && Math.abs(this._actor.scale.y - this._startY) >= this._distanceY)
    );
  }

  public stop(): void {
    this._actor.sx = 0;
    this._actor.sy = 0;
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

@obsolete({ message: 'ex.Action.ScaleBy will be removed in v0.25.0', alternateMethod: 'Set width and hight directly' })
export class ScaleBy implements Action {
  private _actor: Actor;
  public x: number;
  public y: number;
  private _startScale: Vector;
  private _endScale: Vector;
  private _offset: Vector;
  private _distanceX: number;
  private _distanceY: number;
  private _directionX: number;
  private _directionY: number;
  private _started = false;
  private _stopped = false;
  private _speedX: number;
  private _speedY: number;
  constructor(actor: Actor, scaleOffsetX: number, scaleOffsetY: number, speed: number) {
    this._actor = actor;
    this._offset = new Vector(scaleOffsetX, scaleOffsetY);
    this._speedX = this._speedY = speed;
  }

  public update(_delta: number): void {
    if (!this._started) {
      this._started = true;
      this._startScale = this._actor.scale.clone();
      this._endScale = this._startScale.add(this._offset);
      this._distanceX = Math.abs(this._endScale.x - this._startScale.x);
      this._distanceY = Math.abs(this._endScale.y - this._startScale.y);
      this._directionX = this._endScale.x < this._startScale.x ? -1 : 1;
      this._directionY = this._endScale.y < this._startScale.y ? -1 : 1;
    }

    this._actor.sx = this._speedX * this._directionX;
    this._actor.sy = this._speedY * this._directionY;

    if (this.isComplete()) {
      this._actor.scale = this._endScale;
      this._actor.sx = 0;
      this._actor.sy = 0;
    }
  }

  public isComplete(): boolean {
    return (
      this._stopped ||
      (Math.abs(this._actor.scale.x - this._startScale.x) >= this._distanceX &&
        Math.abs(this._actor.scale.y - this._startScale.y) >= this._distanceY)
    );
  }

  public stop(): void {
    this._actor.sx = 0;
    this._actor.sy = 0;
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

export class Delay implements Action {
  public x: number;
  public y: number;
  private _actor: Actor;
  private _elapsedTime: number = 0;
  private _delay: number;
  private _started: boolean = false;
  private _stopped = false;
  constructor(actor: Actor, delay: number) {
    this._actor = actor;
    this._delay = delay;
  }

  public update(delta: number): void {
    if (!this._started) {
      this._started = true;
    }

    this.x = this._actor.pos.x;
    this.y = this._actor.pos.y;

    this._elapsedTime += delta;
  }

  isComplete(): boolean {
    return this._stopped || this._elapsedTime >= this._delay;
  }

  public stop(): void {
    this._stopped = true;
  }

  reset(): void {
    this._elapsedTime = 0;
    this._started = false;
  }
}

export class Blink implements Action {
  private _timeVisible: number = 0;
  private _timeNotVisible: number = 0;
  private _elapsedTime: number = 0;
  private _totalTime: number = 0;
  private _actor: Actor;
  private _duration: number;
  private _stopped: boolean = false;
  private _started: boolean = false;
  constructor(actor: Actor, timeVisible: number, timeNotVisible: number, numBlinks: number = 1) {
    this._actor = actor;
    this._timeVisible = timeVisible;
    this._timeNotVisible = timeNotVisible;
    this._duration = (timeVisible + timeNotVisible) * numBlinks;
  }

  public update(delta: number): void {
    if (!this._started) {
      this._started = true;
    }

    this._elapsedTime += delta;
    this._totalTime += delta;
    if (this._actor.visible && this._elapsedTime >= this._timeVisible) {
      this._actor.visible = false;
      this._elapsedTime = 0;
    }

    if (!this._actor.visible && this._elapsedTime >= this._timeNotVisible) {
      this._actor.visible = true;
      this._elapsedTime = 0;
    }

    if (this.isComplete()) {
      this._actor.visible = true;
    }
  }

  public isComplete(): boolean {
    return this._stopped || this._totalTime >= this._duration;
  }

  public stop(): void {
    this._actor.visible = true;
    this._stopped = true;
  }

  public reset() {
    this._started = false;
    this._elapsedTime = 0;
    this._totalTime = 0;
  }
}

export class Fade implements Action {
  public x: number;
  public y: number;

  private _actor: Actor;
  private _endOpacity: number;
  private _speed: number;
  private _multiplier: number = 1;
  private _started = false;
  private _stopped = false;

  constructor(actor: Actor, endOpacity: number, speed: number) {
    this._actor = actor;
    this._endOpacity = endOpacity;
    this._speed = speed;
  }

  public update(delta: number): void {
    if (!this._started) {
      this._started = true;

      // determine direction when we start
      if (this._endOpacity < this._actor.opacity) {
        this._multiplier = -1;
      } else {
        this._multiplier = 1;
      }
    }

    if (this._speed > 0) {
      this._actor.opacity += (this._multiplier * (Math.abs(this._actor.opacity - this._endOpacity) * delta)) / this._speed;
    }

    this._speed -= delta;

    if (this.isComplete()) {
      this._actor.opacity = this._endOpacity;
    }

    Logger.getInstance().debug('[Action fade] Actor opacity:', this._actor.opacity);
  }

  public isComplete(): boolean {
    return this._stopped || Math.abs(this._actor.opacity - this._endOpacity) < 0.05;
  }

  public stop(): void {
    this._stopped = true;
  }

  public reset(): void {
    this._started = false;
  }
}

export class Die implements Action {
  public x: number;
  public y: number;

  private _actor: Actor;
  private _stopped = false;

  constructor(actor: Actor) {
    this._actor = actor;
  }

  public update(_delta: number): void {
    this._actor.actionQueue.clearActions();
    this._actor.kill();
    this._stopped = true;
  }

  public isComplete(): boolean {
    return this._stopped;
  }

  public stop(): void {
    return;
  }

  public reset(): void {
    return;
  }
}

export class CallMethod implements Action {
  public x: number;
  public y: number;
  private _method: () => any = null;
  private _actor: Actor = null;
  private _hasBeenCalled: boolean = false;
  constructor(actor: Actor, method: () => any) {
    this._actor = actor;
    this._method = method;
  }

  public update(_delta: number) {
    this._method.call(this._actor);
    this._hasBeenCalled = true;
  }
  public isComplete() {
    return this._hasBeenCalled;
  }
  public reset() {
    this._hasBeenCalled = false;
  }
  public stop() {
    this._hasBeenCalled = true;
  }
}

export class Repeat implements Action {
  public x: number;
  public y: number;
  private _actor: Actor;
  private _actionQueue: ActionQueue;
  private _repeat: number;
  private _originalRepeat: number;
  private _stopped: boolean = false;
  constructor(actor: Actor, repeat: number, actions: Action[]) {
    this._actor = actor;
    this._actionQueue = new ActionQueue(actor);
    this._repeat = repeat;
    this._originalRepeat = repeat;

    const len = actions.length;
    for (let i = 0; i < len; i++) {
      actions[i].reset();
      this._actionQueue.add(actions[i]);
    }
  }

  public update(delta: number): void {
    this.x = this._actor.pos.x;
    this.y = this._actor.pos.y;
    if (!this._actionQueue.hasNext()) {
      this._actionQueue.reset();
      this._repeat--;
    }
    this._actionQueue.update(delta);
  }

  public isComplete(): boolean {
    return this._stopped || this._repeat <= 0;
  }

  public stop(): void {
    this._stopped = true;
  }

  public reset(): void {
    this._repeat = this._originalRepeat;
  }
}

export class RepeatForever implements Action {
  public x: number;
  public y: number;
  private _actor: Actor;
  private _actionQueue: ActionQueue;
  private _stopped: boolean = false;
  constructor(actor: Actor, actions: Action[]) {
    this._actor = actor;
    this._actionQueue = new ActionQueue(actor);

    const len = actions.length;
    for (let i = 0; i < len; i++) {
      actions[i].reset();
      this._actionQueue.add(actions[i]);
    }
  }

  public update(delta: number): void {
    this.x = this._actor.pos.x;
    this.y = this._actor.pos.y;
    if (this._stopped) {
      return;
    }

    if (!this._actionQueue.hasNext()) {
      this._actionQueue.reset();
    }

    this._actionQueue.update(delta);
  }

  public isComplete(): boolean {
    return this._stopped;
  }

  public stop(): void {
    this._stopped = true;
    this._actionQueue.clearActions();
  }

  public reset(): void {
    return;
  }
}

/**
 * Action Queues
 *
 * Action queues are part of the [[ActionContext|Action API]] and
 * store the list of actions to be executed for an [[Actor]].
 *
 * Actors implement [[Actor.actions]] which can be manipulated by
 * advanced users to adjust the actions currently being executed in the
 * queue.
 */
export class ActionQueue {
  private _actor: Actor;
  private _actions: Action[] = [];
  private _currentAction: Action;
  private _completedActions: Action[] = [];
  constructor(actor: Actor) {
    this._actor = actor;
  }

  public add(action: Action) {
    this._actions.push(action);
  }

  public remove(action: Action) {
    const index = this._actions.indexOf(action);
    this._actions.splice(index, 1);
  }

  public clearActions(): void {
    this._actions.length = 0;
    this._completedActions.length = 0;
    if (this._currentAction) {
      this._currentAction.stop();
    }
  }

  public getActions(): Action[] {
    return this._actions.concat(this._completedActions);
  }

  public hasNext(): boolean {
    return this._actions.length > 0;
  }

  public reset(): void {
    this._actions = this.getActions();

    const len = this._actions.length;
    for (let i = 0; i < len; i++) {
      this._actions[i].reset();
    }
    this._completedActions = [];
  }

  public update(delta: number) {
    if (this._actions.length > 0) {
      this._currentAction = this._actions[0];
      this._currentAction.update(delta);

      if (this._currentAction.isComplete(this._actor)) {
        this._completedActions.push(this._actions.shift());
      }
    }
  }
}
