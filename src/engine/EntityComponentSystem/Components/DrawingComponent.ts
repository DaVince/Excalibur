import { Vector } from '../../Algebra';
import { Component } from '../Component';
import { BuiltinComponentType } from '../ComponentTypes';
import { Entity } from '../Entity';
import { Drawable } from '../../Drawing/Drawable';
import { EventDispatcher } from '../../EventDispatcher';
import { hasPreDraw, hasPostDraw, OnPreDraw, OnPostDraw } from '../../Interfaces/LifecycleEvents';
import { GameEvent, PreDrawEvent, PostDrawEvent } from '../../Events';
import * as Events from '../../Events';

export interface DrawingOptions {
  /**
   * Name of current graphic to use
   */
  current?: string;

  /**
   * Optional visible flag, if the drawing component is not visible it will not be displayed
   */
  visible?: boolean;

  // TODO handle opacity

  /**
   * List of graphics
   */
  graphics?: { [graphicName: string]: Drawable };

  /**
   * Optional offset in absolute pixels to shift all graphics in this component from each graphic's anchor (default is top left corner)
   */
  offset?: ex.Vector;

  /**
   * Optional rotation to apply to each graphic in this component
   */
  rotation?: number;
}

/**
 * Component to manage drawings, using with the position component
 */
export class DrawingComponent extends EventDispatcher<Entity> implements Component, OnPreDraw, OnPostDraw {
  public readonly type = BuiltinComponentType.Drawing;
  public owner: Entity = null;

  private _currentDrawing: Drawable;
  private _graphics: { [graphicName: string]: Drawable } = {};
  constructor(options?: DrawingOptions) {
    super(null);
    // Defaults
    options = {
      visible: this.visible,
      ...options
    };

    const { current, visible, graphics, offset } = options;

    this._graphics = graphics || {};
    this.offset = offset || this.offset;
    this.visible = !!visible;

    if (current && this._graphics[current]) {
      this._currentDrawing = this._graphics[current];
    }
  }
  onAdd(entity: Entity) {
    this.setTarget(entity);
    this.wire(entity.eventDispatcher);
  }

  onRemove(entity: Entity) {
    this.setTarget(null);
    this.unwire(entity.eventDispatcher);
  }

  /**
   * Sets or gets wether any drawing should be visible in this component
   */
  public visible: boolean = true;

  /**
   * Sets or gets wither all drawings should have an opacity, if not set drawings individual opacity is respected
   */
  public opacity?: number | null = null;

  /**
   * Offset to apply to all drawings in this component if set, if null the drawing's offset is respected
   */
  public offset?: Vector | null = null;

  /**
   * Anchor to apply to all drawings in this component if set, if null the drawing's anchor is respected
   */
  public anchor?: Vector | null = null;

  /**
   * Returns the currently displayed graphic, null if hidden
   */
  public get current(): Drawable {
    return this._currentDrawing;
  }

  /**
   * Returns all graphics associated with this component
   */
  public get graphics(): { [graphicName: string]: Drawable } {
    return this._graphics;
  }

  /**
   * Adds a graphic to this component, if the name is "default" or not specified, it will be shown by default without needing to call `show("default")`
   * @param graphic
   */
  public add(graphic: Drawable): Drawable;
  public add(name: string, graphic: Drawable): Drawable;
  public add(nameOrDrawable: string | Drawable, graphic?: Drawable): Drawable {
    let name = 'default';
    let graphicToSet: Drawable = null;
    if (typeof nameOrDrawable === 'string') {
      name = nameOrDrawable;
      graphicToSet = graphic;
    } else {
      graphicToSet = nameOrDrawable;
    }

    this._graphics[name] = graphicToSet;
    if (name === 'default') {
      this.show('default');
    }
    return graphicToSet;
  }

  /**
   * Show a graphic by name, returns a promise that resolves when graphic has finished displaying
   */
  public show(graphicName: string | number): Promise<Drawable> {
    this._currentDrawing = this.graphics[graphicName.toString()];

    // Todo does this make sense for looping animations
    // how do we know this??
    return Promise.resolve(this._currentDrawing);
  }

  /**
   * Immediately show nothing
   */
  public hide(): Promise<void> {
    this._currentDrawing = null;
    return Promise.resolve();
  }

  /**
   * Returns the current drawings width in pixels, as it would appear on screen factoring width.
   * If there isn't a current drawing returns [[DrawingComponent.noDrawingWidth]].
   */
  public get width(): number {
    if (this._currentDrawing) {
      return this._currentDrawing.drawWidth;
    }
    return 0;
  }

  /**
   * Returns the current drawings height in pixels, as it would appear on screen factoring height.
   * If there isn't a current drawing returns [[DrawingComponent.noDrawingHeight]].
   */
  public get height(): number {
    if (this._currentDrawing) {
      return this._currentDrawing.drawHeight;
    }
    return 0;
  }

  // TODO call owner predraw postdraw!!!
  /**
   * It is not recommended that internal excalibur methods be overriden, do so at your own risk.
   *
   * Internal _predraw handler for [[onPreDraw]] lifecycle event
   * @internal
   */
  public _predraw(ctx: CanvasRenderingContext2D, delta: number): void {
    if (hasPreDraw(this.owner)) {
      this.emit('predraw', new PreDrawEvent(ctx, delta, this.owner));
      this.owner.onPreDraw(ctx, delta);
    }
    this.onPreDraw(ctx, delta);
  }

  /**
   * It is not recommended that internal excalibur methods be overriden, do so at your own risk.
   *
   * Internal _postdraw handler for [[onPostDraw]] lifecycle event
   * @internal
   */
  public _postdraw(ctx: CanvasRenderingContext2D, delta: number): void {
    if (hasPostDraw(this.owner)) {
      this.emit('postdraw', new PostDrawEvent(ctx, delta, this.owner));
      this.owner.onPostDraw(ctx, delta);
    }
    this.onPostDraw(ctx, delta);
  }

  public onPreDraw(_ctx: CanvasRenderingContext2D, _delta: number) {
    // override me
  }

  public onPostDraw(_ctx: CanvasRenderingContext2D, _delta: number) {
    // override me
  }

  on(eventName: Events.predraw, handler: (event: Events.PreDrawEvent) => void): void;
  on(eventName: Events.postdraw, handler: (event: Events.PostDrawEvent) => void): void;
  on(eventName: string, handler: (event: GameEvent<Entity>) => void): void;
  on(eventName: string, handler: (event: any) => void): void {
    this.on(eventName, handler);
  }
  once(eventName: Events.predraw, handler: (event: Events.PreDrawEvent) => void): void;
  once(eventName: Events.postdraw, handler: (event: Events.PostDrawEvent) => void): void;
  once(eventName: string, handler: (event: GameEvent<Entity>) => void): void;
  once(eventName: string, handler: (event: any) => void): void {
    this.once(eventName, handler);
  }
  off(eventName: Events.predraw, handler?: (event: Events.PreDrawEvent) => void): void;
  off(eventName: Events.postdraw, handler?: (event: Events.PostDrawEvent) => void): void;
  off(eventName: string, handler?: (event: GameEvent<Entity>) => void): void;
  off(eventName: string, handler?: (event: any) => void): void {
    this.off(eventName, handler);
  }

  /**
   * Returns a shallow copy of this component
   */
  clone(): DrawingComponent {
    return this;
  }
}
