import * as ex from '@excalibur';
import { TestUtils } from './util/TestUtils';
import { ExcaliburMatchers } from 'excalibur-jasmine';
import { canonicalizeAngle } from '../engine/Util/Util';

describe('Action', () => {
  let actor: ex.Actor;

  let engine: ex.Engine & any;
  let scene: ex.Scene;

  beforeEach(() => {
    jasmine.addMatchers(ExcaliburMatchers);
    engine = TestUtils.engine({ width: 100, height: 100 });

    actor = new ex.Actor();
    scene = new ex.Scene(engine);
    engine.currentScene = scene;

    spyOn(scene, 'draw').and.callThrough();
    spyOn(actor, 'draw');
  });

  describe('blink', () => {
    it('can blink on and off', () => {
      expect(actor.visible).toBe(true);
      actor.actions.blink(200, 200);

      actor.update(engine, 200);
      expect(actor.visible).toBe(false);

      actor.update(engine, 250);
      expect(actor.visible).toBe(true);
    });

    it('can blink at a frequency forever', () => {
      expect(actor.visible).toBe(true);
      actor.actions.blink(200, 200).repeatForever();

      for (let i = 0; i < 2; i++) {
        actor.update(engine, 200);
        expect(actor.visible).toBe(false);

        actor.update(engine, 200);
        expect(actor.visible).toBe(true);

        actor.update(engine, 200);
      }
    });

    it('can be stopped', () => {
      expect(actor.visible).toBe(true);
      actor.actions.blink(1, 3000);

      actor.update(engine, 500);
      expect(actor.visible).toBe(false);

      actor.actions.clearActions();

      actor.update(engine, 500);
      actor.update(engine, 500);
      expect(actor.visible).toBe(true);
    });
  });

  describe('color', () => {
    it('is cloned from constructor', () => {
      const color = ex.Color.Azure;
      const sut = new ex.Actor(null, null, null, null, color);

      expect(sut.color).not.toBe(color, 'Color is not expected to be same instance');
    });

    it('is cloned from property setter', () => {
      const color = ex.Color.Azure;
      const sut = new ex.Actor();

      sut.color = color;

      expect(sut.color).not.toBe(color, 'Color is not expected to be same instance');
    });
  });

  describe('die', () => {
    it('can remove actor from scene', () => {
      scene.add(actor);
      expect(scene.actors.length).toBe(1);
      actor.actions.die();
      scene.update(engine, 100);
      expect(scene.actors.length).toBe(0);
    });

    it('can perform actions and then die', () => {
      scene.add(actor);
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);
      expect(scene.actors.length).toBe(1);

      actor.actions.moveTo(100, 0, 100).delay(1000).die();
      actor.update(engine, 1000);

      expect(actor.pos.x).toBe(100);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 500);
      expect(actor.pos.x).toBe(100);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      scene.update(engine, 100);
      expect(scene.actors.length).toBe(0);
    });
  });

  describe('delay', () => {
    it('can be delay an action by an amount off time', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.delay(1000).moveTo(20, 0, 20);
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
    });

    it('can be stopped', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.delay(1000).moveTo(20, 0, 20);
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(0);

      actor.actions.clearActions();
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(0);
    });

    it('can be a promise', (done) => {
      const spy = jasmine.createSpy();
      actor.actions.delay(1000);
      actor.actions.callMethod(spy);
      actor.actions.asPromise().then(() => {
        expect(spy).toHaveBeenCalled();
        done();
      });
      actor.update(engine, 1000);
      actor.update(engine, 0);
      actor.update(engine, 0);
    });
  });

  describe('moveBy', () => {
    it('can be moved to a location by a certain time', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveBy(100, 0, 50);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(50);
      expect(actor.pos.y).toBe(0);
    });

    it('can be stopped', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveBy(20, 0, 20);
      actor.update(engine, 500);

      actor.actions.clearActions();
      expect(actor.pos.x).toBe(10);
      expect(actor.pos.y).toBe(0);

      // Actor should not move after stop
      actor.update(engine, 500);
      expect(actor.pos.x).toBe(10);
      expect(actor.pos.y).toBe(0);
    });
  });

  describe('moveTo', () => {
    it('can be moved to a location at a speed', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveTo(100, 0, 100);
      actor.update(engine, 500);

      expect(actor.pos.x).toBe(50);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 500);
      expect(actor.pos.x).toBe(100);
      expect(actor.pos.y).toBe(0);
    });

    it('can be stopped', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveTo(20, 0, 10);
      actor.update(engine, 500);

      actor.actions.clearActions();
      expect(actor.pos.x).toBe(5);
      expect(actor.pos.y).toBe(0);

      // Actor should not move after stop
      actor.update(engine, 500);
      expect(actor.pos.x).toBe(5);
      expect(actor.pos.y).toBe(0);
    });
  });

  describe('easeTo', () => {
    it('can be eased to a location given an easing function', () => {
      expect(actor.pos).toBeVector(ex.vec(0, 0));

      actor.actions.easeTo(100, 0, 1000, ex.EasingFunctions.EaseInOutCubic);

      actor.update(engine, 500);
      expect(actor.pos).toBeVector(ex.vec(50, 0));
      expect(actor.vel).toBeVector(ex.vec(100, 0));

      actor.update(engine, 500);
      expect(actor.pos).toBeVector(ex.vec(100, 0));
      expect(actor.vel).toBeVector(ex.vec(0, 0));

      actor.update(engine, 500);
      expect(actor.pos).toBeVector(ex.vec(100, 0));
      expect(actor.vel).toBeVector(ex.vec(0, 0));
    });

    it('can be stopped', () => {
      expect(actor.pos).toBeVector(ex.vec(0, 0));

      actor.actions.easeTo(100, 0, 1000, ex.EasingFunctions.EaseInOutCubic);

      actor.update(engine, 500);
      expect(actor.pos).toBeVector(ex.vec(50, 0));
      expect(actor.vel).toBeVector(ex.vec(100, 0));

      actor.actions.clearActions();

      // actor should not move and should have zero velocity after stopping
      actor.update(engine, 500);
      expect(actor.pos).toBeVector(ex.vec(50, 0));
      expect(actor.vel).toBeVector(ex.vec(0, 0));
    });
  });

  describe('repeat', () => {
    it('can repeat previous actions', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveTo(20, 0, 10).moveTo(0, 0, 10).repeat();

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(10);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1);
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(10);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1);
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(10);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);
    });

    it('can be stopped', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveTo(20, 0, 10).moveTo(0, 0, 10).repeat();

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(10);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);

      actor.actions.clearActions();
      actor.update(engine, 1);
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1);
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(20);
      expect(actor.pos.y).toBe(0);
    });
  });

  describe('repeatForever', () => {
    it('can repeat previous actions forever', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveTo(20, 0, 10).moveTo(0, 0, 10).repeatForever();

      for (let i = 0; i < 20; i++) {
        actor.update(engine, 1000);
        expect(actor.pos.x).toBe(10);
        expect(actor.pos.y).toBe(0);

        actor.update(engine, 1000);
        expect(actor.pos.x).toBe(20);
        expect(actor.pos.y).toBe(0);

        actor.update(engine, 1);
        actor.update(engine, 1000);
        expect(actor.pos.x).toBe(10);
        expect(actor.pos.y).toBe(0);

        actor.update(engine, 1000);
        expect(actor.pos.x).toBe(0);
        expect(actor.pos.y).toBe(0);

        actor.update(engine, 1);
      }
    });

    it('can be stopped', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      actor.actions.moveTo(20, 0, 10).moveTo(0, 0, 10).repeatForever();

      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(10);
      expect(actor.pos.y).toBe(0);

      actor.actions.clearActions();

      for (let i = 0; i < 20; i++) {
        actor.update(engine, 1000);
        expect(actor.pos.x).toBe(10);
        expect(actor.pos.y).toBe(0);
      }
    });
  });

  describe('rotateTo', () => {
    it('can be rotated to an angle at a speed via ShortestPath (default)', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateTo(Math.PI / 2, Math.PI / 2);

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 4);

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 2);

      actor.update(engine, 500);
      expect(actor.rx).toBe(0);
    });

    it('can be rotated to an angle at a speed via LongestPath', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateTo(Math.PI / 2, Math.PI / 2, ex.RotationType.LongestPath);

      actor.update(engine, 1000);
      //rotation is currently incremented by rx delta ,so will be negative while moving counterclockwise
      expect(actor.rotation).toBe(canonicalizeAngle((-1 * Math.PI) / 2));

      actor.update(engine, 2000);
      expect(actor.rotation).toBe(canonicalizeAngle((-3 * Math.PI) / 2));

      actor.update(engine, 500);
      expect(actor.rotation).toBe(canonicalizeAngle(Math.PI / 2));
      expect(actor.rx).toBe(0);
    });

    it('can be rotated to an angle at a speed via Clockwise', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateTo((3 * Math.PI) / 2, Math.PI / 2, ex.RotationType.Clockwise);

      actor.update(engine, 2000);
      expect(actor.rotation).toBe(Math.PI);

      actor.update(engine, 1000);
      expect(actor.rotation).toBe((3 * Math.PI) / 2);

      actor.update(engine, 500);
      expect(actor.rotation).toBe((3 * Math.PI) / 2);
      expect(actor.rx).toBe(0);
    });

    it('can be rotated to an angle at a speed via CounterClockwise', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateTo(Math.PI / 2, Math.PI / 2, ex.RotationType.CounterClockwise);
      actor.update(engine, 2000);
      expect(actor.rotation).toBe(canonicalizeAngle(-Math.PI));

      actor.update(engine, 1000);
      expect(actor.rotation).toBe(canonicalizeAngle((-3 * Math.PI) / 2));

      actor.update(engine, 500);
      expect(actor.rotation).toBe(canonicalizeAngle(Math.PI / 2));
      expect(actor.rx).toBe(0);

      // rotating back to 0, starting at PI / 2
      actor.actions.rotateTo(0, Math.PI / 2, ex.RotationType.CounterClockwise);
      actor.update(engine, 1000);
      expect(actor.rotation).toBe(canonicalizeAngle(0));

      actor.update(engine, 1);
      expect(actor.rx).toBe(0);
    });

    it('can be stopped', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateTo(Math.PI / 2, Math.PI / 2);

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 4);

      actor.actions.clearActions();

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 4);
    });
  });

  describe('rotateBy', () => {
    it('can be rotated to an angle by a certain time via ShortestPath (default)', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateBy(Math.PI / 2, Math.PI / 4);

      actor.update(engine, 1000);
      expect(actor.rotation).toBe(Math.PI / 4);

      actor.update(engine, 1000);
      expect(actor.rotation).toBe(Math.PI / 2);

      actor.update(engine, 500);
      expect(actor.rx).toBe(0);
    });

    it('can be rotated to an angle by a certain time via LongestPath', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateBy(Math.PI / 2, Math.PI / 2, ex.RotationType.LongestPath);

      actor.update(engine, 1000);
      expect(actor.rotation).toBe(canonicalizeAngle((-1 * Math.PI) / 2));

      actor.update(engine, 2000);
      expect(actor.rotation).toBe(canonicalizeAngle((-3 * Math.PI) / 2));

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 2);
      expect(actor.rx).toBe(0);
    });

    it('can be rotated to an angle by a certain time via Clockwise', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateBy(Math.PI / 2, Math.PI / 2, ex.RotationType.Clockwise);

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 4);

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 2);

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 2);
      expect(actor.rx).toBe(0);
    });

    it('can be rotated to an angle by a certain time via CounterClockwise', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateBy(Math.PI / 2, Math.PI / 2, ex.RotationType.LongestPath);

      actor.update(engine, 1000);
      expect(actor.rotation).toBe(canonicalizeAngle((-1 * Math.PI) / 2));

      actor.update(engine, 2000);
      expect(actor.rotation).toBe(canonicalizeAngle((-3 * Math.PI) / 2));

      actor.update(engine, 500);
      expect(actor.rotation).toBe(Math.PI / 2);
      expect(actor.rx).toBe(0);
    });

    it('can be stopped', () => {
      expect(actor.rotation).toBe(0);

      actor.actions.rotateBy(Math.PI / 2, Math.PI / 4);

      actor.update(engine, 1000);
      actor.actions.clearActions();
      expect(actor.rotation).toBe(Math.PI / 4);

      actor.update(engine, 1000);
      expect(actor.rotation).toBe(Math.PI / 4);
    });
  });

  describe('scaleTo', () => {
    it('can be scaled at a speed', () => {
      expect(actor.scale.x).toBe(1);
      expect(actor.scale.y).toBe(1);

      actor.actions.scaleTo(2, 4, 0.5, 0.5);
      actor.update(engine, 1000);

      expect(actor.scale.x).toBe(1.5);
      expect(actor.scale.y).toBe(1.5);
      actor.update(engine, 1000);

      expect(actor.scale.x).toBe(2);
      expect(actor.scale.y).toBe(2);
      actor.update(engine, 1000);

      expect(actor.scale.x).toBe(2);
      expect(actor.scale.y).toBe(2.5);
    });

    it('can be stopped', () => {
      expect(actor.scale.x).toBe(1);
      expect(actor.scale.y).toBe(1);

      actor.actions.scaleTo(2, 2, 0.5, 0.5);
      actor.update(engine, 1000);

      actor.actions.clearActions();
      expect(actor.scale.x).toBe(1.5);
      expect(actor.scale.y).toBe(1.5);

      actor.update(engine, 1000);
      expect(actor.scale.x).toBe(1.5);
      expect(actor.scale.y).toBe(1.5);
    });
  });

  describe('scaleBy', () => {
    it('can be scaled by a certain time', () => {
      expect(actor.scale.x).toBe(1);
      expect(actor.scale.y).toBe(1);

      actor.actions.scaleBy(4, 4, 4);

      actor.update(engine, 500);
      expect(actor.scale.x).toBe(3);
      expect(actor.scale.y).toBe(3);

      actor.update(engine, 500);
      actor.update(engine, 1);
      expect(actor.scale.x).toBe(5);
      expect(actor.scale.y).toBe(5);
    });

    it('can be stopped', () => {
      expect(actor.scale.x).toBe(1);
      expect(actor.scale.y).toBe(1);

      actor.actions.scaleBy(4, 4, 3);

      actor.update(engine, 500);

      actor.actions.clearActions();
      expect(actor.scale.x).toBe(2.5);
      expect(actor.scale.y).toBe(2.5);

      actor.update(engine, 500);
      expect(actor.scale.x).toBe(2.5);
      expect(actor.scale.y).toBe(2.5);
    });
  });

  describe('follow', () => {
    it('can work with another actor', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      const actorToFollow = new ex.Actor(10, 0);
      actorToFollow.actions.moveTo(100, 0, 10);
      actor.actions.follow(actorToFollow);
      // actor.update(engine, 1000);
      // expect(actor.pos.x).toBe(actorToFollow.x);

      for (let i = 1; i < 10; i++) {
        // actor.follow(actorToFollow);
        actorToFollow.update(engine, 1000);
        actor.update(engine, 1000);
        expect(actor.pos.x).toBe(actorToFollow.pos.x - 10);
      }
    });
  });

  describe('meet', () => {
    it('can meet another actor', () => {
      expect(actor.pos.x).toBe(0);
      expect(actor.pos.y).toBe(0);

      // testing basic meet
      const actorToMeet = new ex.Actor(10, 0);
      actorToMeet.actions.moveTo(100, 0, 10);
      actor.actions.meet(actorToMeet);

      for (let i = 0; i < 9; i++) {
        actorToMeet.update(engine, 1000);
        actor.update(engine, 1000);
        expect(actor.pos.x).toBe(actorToMeet.pos.x - 10);
      }

      // actor should have caught up to actorToFollow since it stopped moving
      actorToMeet.update(engine, 1000);
      actor.update(engine, 1000);
      expect(actor.pos.x).toBe(actorToMeet.pos.x);
    });
  });

  describe('fade', () => {
    it('can go from 1 from 0', () => {
      actor.opacity = 0;

      actor.actions.fade(1, 200);
      for (let i = 0; i < 10; i++) {
        actor.update(engine, 20);
      }

      expect(actor.opacity).toBe(1);
    });

    it('can go back and forth from 0 to 1 (#512)', () => {
      actor.opacity = 0;

      actor.actions.fade(1, 200).fade(0, 200);
      for (let i = 0; i < 20; i++) {
        actor.update(engine, 20);
      }

      expect(actor.opacity).toBe(0);
    });

    it('can go back and forth from 0 to 1 more than once (#512)', () => {
      actor.opacity = 0;

      actor.actions.fade(1, 200).fade(0, 200).repeat(1);
      for (let i = 0; i < 40; i++) {
        actor.update(engine, 20);
      }

      expect(actor.opacity).toBe(0);
    });
  });
});
