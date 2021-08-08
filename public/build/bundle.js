
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    function create_animation(node, from, fn, params) {
        if (!from)
            return noop;
        const to = node.getBoundingClientRect();
        if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
            return noop;
        const { delay = 0, duration = 300, easing = identity, 
        // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
        start: start_time = now() + delay, 
        // @ts-ignore todo:
        end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
        let running = true;
        let started = false;
        let name;
        function start() {
            if (css) {
                name = create_rule(node, 0, 1, duration, delay, easing, css);
            }
            if (!delay) {
                started = true;
            }
        }
        function stop() {
            if (css)
                delete_rule(node, name);
            running = false;
        }
        loop(now => {
            if (!started && now >= start_time) {
                started = true;
            }
            if (started && now >= end) {
                tick(1, 0);
                stop();
            }
            if (!running) {
                return false;
            }
            if (started) {
                const p = now - start_time;
                const t = 0 + 1 * easing(p / duration);
                tick(t, 1 - t);
            }
            return true;
        });
        start();
        tick(0, 1);
        return stop;
    }
    function fix_position(node) {
        const style = getComputedStyle(node);
        if (style.position !== 'absolute' && style.position !== 'fixed') {
            const { width, height } = style;
            const a = node.getBoundingClientRect();
            node.style.position = 'absolute';
            node.style.width = width;
            node.style.height = height;
            add_transform(node, a);
        }
    }
    function add_transform(node, a) {
        const b = node.getBoundingClientRect();
        if (a.left !== b.left || a.top !== b.top) {
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;
            node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function fix_and_outro_and_destroy_block(block, lookup) {
        block.f();
        outro_and_destroy_block(block, lookup);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function each(items, fn) {
        let str = '';
        for (let i = 0; i < items.length; i += 1) {
            str += fn(items[i], i);
        }
        return str;
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    /*!
     * validate.js 0.13.1
     *
     * (c) 2013-2019 Nicklas Ansman, 2013 Wrapp
     * Validate.js may be freely distributed under the MIT license.
     * For all details and documentation:
     * http://validatejs.org/
     */

    var validate = createCommonjsModule(function (module, exports) {
    (function(exports, module, define) {

      // The main function that calls the validators specified by the constraints.
      // The options are the following:
      //   - format (string) - An option that controls how the returned value is formatted
      //     * flat - Returns a flat array of just the error messages
      //     * grouped - Returns the messages grouped by attribute (default)
      //     * detailed - Returns an array of the raw validation data
      //   - fullMessages (boolean) - If `true` (default) the attribute name is prepended to the error.
      //
      // Please note that the options are also passed to each validator.
      var validate = function(attributes, constraints, options) {
        options = v.extend({}, v.options, options);

        var results = v.runValidations(attributes, constraints, options)
          ;

        if (results.some(function(r) { return v.isPromise(r.error); })) {
          throw new Error("Use validate.async if you want support for promises");
        }
        return validate.processValidationResults(results, options);
      };

      var v = validate;

      // Copies over attributes from one or more sources to a single destination.
      // Very much similar to underscore's extend.
      // The first argument is the target object and the remaining arguments will be
      // used as sources.
      v.extend = function(obj) {
        [].slice.call(arguments, 1).forEach(function(source) {
          for (var attr in source) {
            obj[attr] = source[attr];
          }
        });
        return obj;
      };

      v.extend(validate, {
        // This is the version of the library as a semver.
        // The toString function will allow it to be coerced into a string
        version: {
          major: 0,
          minor: 13,
          patch: 1,
          metadata: null,
          toString: function() {
            var version = v.format("%{major}.%{minor}.%{patch}", v.version);
            if (!v.isEmpty(v.version.metadata)) {
              version += "+" + v.version.metadata;
            }
            return version;
          }
        },

        // Below is the dependencies that are used in validate.js

        // The constructor of the Promise implementation.
        // If you are using Q.js, RSVP or any other A+ compatible implementation
        // override this attribute to be the constructor of that promise.
        // Since jQuery promises aren't A+ compatible they won't work.
        Promise: typeof Promise !== "undefined" ? Promise : /* istanbul ignore next */ null,

        EMPTY_STRING_REGEXP: /^\s*$/,

        // Runs the validators specified by the constraints object.
        // Will return an array of the format:
        //     [{attribute: "<attribute name>", error: "<validation result>"}, ...]
        runValidations: function(attributes, constraints, options) {
          var results = []
            , attr
            , validatorName
            , value
            , validators
            , validator
            , validatorOptions
            , error;

          if (v.isDomElement(attributes) || v.isJqueryElement(attributes)) {
            attributes = v.collectFormValues(attributes);
          }

          // Loops through each constraints, finds the correct validator and run it.
          for (attr in constraints) {
            value = v.getDeepObjectValue(attributes, attr);
            // This allows the constraints for an attribute to be a function.
            // The function will be called with the value, attribute name, the complete dict of
            // attributes as well as the options and constraints passed in.
            // This is useful when you want to have different
            // validations depending on the attribute value.
            validators = v.result(constraints[attr], value, attributes, attr, options, constraints);

            for (validatorName in validators) {
              validator = v.validators[validatorName];

              if (!validator) {
                error = v.format("Unknown validator %{name}", {name: validatorName});
                throw new Error(error);
              }

              validatorOptions = validators[validatorName];
              // This allows the options to be a function. The function will be
              // called with the value, attribute name, the complete dict of
              // attributes as well as the options and constraints passed in.
              // This is useful when you want to have different
              // validations depending on the attribute value.
              validatorOptions = v.result(validatorOptions, value, attributes, attr, options, constraints);
              if (!validatorOptions) {
                continue;
              }
              results.push({
                attribute: attr,
                value: value,
                validator: validatorName,
                globalOptions: options,
                attributes: attributes,
                options: validatorOptions,
                error: validator.call(validator,
                    value,
                    validatorOptions,
                    attr,
                    attributes,
                    options)
              });
            }
          }

          return results;
        },

        // Takes the output from runValidations and converts it to the correct
        // output format.
        processValidationResults: function(errors, options) {
          errors = v.pruneEmptyErrors(errors, options);
          errors = v.expandMultipleErrors(errors, options);
          errors = v.convertErrorMessages(errors, options);

          var format = options.format || "grouped";

          if (typeof v.formatters[format] === 'function') {
            errors = v.formatters[format](errors);
          } else {
            throw new Error(v.format("Unknown format %{format}", options));
          }

          return v.isEmpty(errors) ? undefined : errors;
        },

        // Runs the validations with support for promises.
        // This function will return a promise that is settled when all the
        // validation promises have been completed.
        // It can be called even if no validations returned a promise.
        async: function(attributes, constraints, options) {
          options = v.extend({}, v.async.options, options);

          var WrapErrors = options.wrapErrors || function(errors) {
            return errors;
          };

          // Removes unknown attributes
          if (options.cleanAttributes !== false) {
            attributes = v.cleanAttributes(attributes, constraints);
          }

          var results = v.runValidations(attributes, constraints, options);

          return new v.Promise(function(resolve, reject) {
            v.waitForResults(results).then(function() {
              var errors = v.processValidationResults(results, options);
              if (errors) {
                reject(new WrapErrors(errors, options, attributes, constraints));
              } else {
                resolve(attributes);
              }
            }, function(err) {
              reject(err);
            });
          });
        },

        single: function(value, constraints, options) {
          options = v.extend({}, v.single.options, options, {
            format: "flat",
            fullMessages: false
          });
          return v({single: value}, {single: constraints}, options);
        },

        // Returns a promise that is resolved when all promises in the results array
        // are settled. The promise returned from this function is always resolved,
        // never rejected.
        // This function modifies the input argument, it replaces the promises
        // with the value returned from the promise.
        waitForResults: function(results) {
          // Create a sequence of all the results starting with a resolved promise.
          return results.reduce(function(memo, result) {
            // If this result isn't a promise skip it in the sequence.
            if (!v.isPromise(result.error)) {
              return memo;
            }

            return memo.then(function() {
              return result.error.then(function(error) {
                result.error = error || null;
              });
            });
          }, new v.Promise(function(r) { r(); })); // A resolved promise
        },

        // If the given argument is a call: function the and: function return the value
        // otherwise just return the value. Additional arguments will be passed as
        // arguments to the function.
        // Example:
        // ```
        // result('foo') // 'foo'
        // result(Math.max, 1, 2) // 2
        // ```
        result: function(value) {
          var args = [].slice.call(arguments, 1);
          if (typeof value === 'function') {
            value = value.apply(null, args);
          }
          return value;
        },

        // Checks if the value is a number. This function does not consider NaN a
        // number like many other `isNumber` functions do.
        isNumber: function(value) {
          return typeof value === 'number' && !isNaN(value);
        },

        // Returns false if the object is not a function
        isFunction: function(value) {
          return typeof value === 'function';
        },

        // A simple check to verify that the value is an integer. Uses `isNumber`
        // and a simple modulo check.
        isInteger: function(value) {
          return v.isNumber(value) && value % 1 === 0;
        },

        // Checks if the value is a boolean
        isBoolean: function(value) {
          return typeof value === 'boolean';
        },

        // Uses the `Object` function to check if the given argument is an object.
        isObject: function(obj) {
          return obj === Object(obj);
        },

        // Simply checks if the object is an instance of a date
        isDate: function(obj) {
          return obj instanceof Date;
        },

        // Returns false if the object is `null` of `undefined`
        isDefined: function(obj) {
          return obj !== null && obj !== undefined;
        },

        // Checks if the given argument is a promise. Anything with a `then`
        // function is considered a promise.
        isPromise: function(p) {
          return !!p && v.isFunction(p.then);
        },

        isJqueryElement: function(o) {
          return o && v.isString(o.jquery);
        },

        isDomElement: function(o) {
          if (!o) {
            return false;
          }

          if (!o.querySelectorAll || !o.querySelector) {
            return false;
          }

          if (v.isObject(document) && o === document) {
            return true;
          }

          // http://stackoverflow.com/a/384380/699304
          /* istanbul ignore else */
          if (typeof HTMLElement === "object") {
            return o instanceof HTMLElement;
          } else {
            return o &&
              typeof o === "object" &&
              o !== null &&
              o.nodeType === 1 &&
              typeof o.nodeName === "string";
          }
        },

        isEmpty: function(value) {
          var attr;

          // Null and undefined are empty
          if (!v.isDefined(value)) {
            return true;
          }

          // functions are non empty
          if (v.isFunction(value)) {
            return false;
          }

          // Whitespace only strings are empty
          if (v.isString(value)) {
            return v.EMPTY_STRING_REGEXP.test(value);
          }

          // For arrays we use the length property
          if (v.isArray(value)) {
            return value.length === 0;
          }

          // Dates have no attributes but aren't empty
          if (v.isDate(value)) {
            return false;
          }

          // If we find at least one property we consider it non empty
          if (v.isObject(value)) {
            for (attr in value) {
              return false;
            }
            return true;
          }

          return false;
        },

        // Formats the specified strings with the given values like so:
        // ```
        // format("Foo: %{foo}", {foo: "bar"}) // "Foo bar"
        // ```
        // If you want to write %{...} without having it replaced simply
        // prefix it with % like this `Foo: %%{foo}` and it will be returned
        // as `"Foo: %{foo}"`
        format: v.extend(function(str, vals) {
          if (!v.isString(str)) {
            return str;
          }
          return str.replace(v.format.FORMAT_REGEXP, function(m0, m1, m2) {
            if (m1 === '%') {
              return "%{" + m2 + "}";
            } else {
              return String(vals[m2]);
            }
          });
        }, {
          // Finds %{key} style patterns in the given string
          FORMAT_REGEXP: /(%?)%\{([^\}]+)\}/g
        }),

        // "Prettifies" the given string.
        // Prettifying means replacing [.\_-] with spaces as well as splitting
        // camel case words.
        prettify: function(str) {
          if (v.isNumber(str)) {
            // If there are more than 2 decimals round it to two
            if ((str * 100) % 1 === 0) {
              return "" + str;
            } else {
              return parseFloat(Math.round(str * 100) / 100).toFixed(2);
            }
          }

          if (v.isArray(str)) {
            return str.map(function(s) { return v.prettify(s); }).join(", ");
          }

          if (v.isObject(str)) {
            if (!v.isDefined(str.toString)) {
              return JSON.stringify(str);
            }

            return str.toString();
          }

          // Ensure the string is actually a string
          str = "" + str;

          return str
            // Splits keys separated by periods
            .replace(/([^\s])\.([^\s])/g, '$1 $2')
            // Removes backslashes
            .replace(/\\+/g, '')
            // Replaces - and - with space
            .replace(/[_-]/g, ' ')
            // Splits camel cased words
            .replace(/([a-z])([A-Z])/g, function(m0, m1, m2) {
              return "" + m1 + " " + m2.toLowerCase();
            })
            .toLowerCase();
        },

        stringifyValue: function(value, options) {
          var prettify = options && options.prettify || v.prettify;
          return prettify(value);
        },

        isString: function(value) {
          return typeof value === 'string';
        },

        isArray: function(value) {
          return {}.toString.call(value) === '[object Array]';
        },

        // Checks if the object is a hash, which is equivalent to an object that
        // is neither an array nor a function.
        isHash: function(value) {
          return v.isObject(value) && !v.isArray(value) && !v.isFunction(value);
        },

        contains: function(obj, value) {
          if (!v.isDefined(obj)) {
            return false;
          }
          if (v.isArray(obj)) {
            return obj.indexOf(value) !== -1;
          }
          return value in obj;
        },

        unique: function(array) {
          if (!v.isArray(array)) {
            return array;
          }
          return array.filter(function(el, index, array) {
            return array.indexOf(el) == index;
          });
        },

        forEachKeyInKeypath: function(object, keypath, callback) {
          if (!v.isString(keypath)) {
            return undefined;
          }

          var key = ""
            , i
            , escape = false;

          for (i = 0; i < keypath.length; ++i) {
            switch (keypath[i]) {
              case '.':
                if (escape) {
                  escape = false;
                  key += '.';
                } else {
                  object = callback(object, key, false);
                  key = "";
                }
                break;

              case '\\':
                if (escape) {
                  escape = false;
                  key += '\\';
                } else {
                  escape = true;
                }
                break;

              default:
                escape = false;
                key += keypath[i];
                break;
            }
          }

          return callback(object, key, true);
        },

        getDeepObjectValue: function(obj, keypath) {
          if (!v.isObject(obj)) {
            return undefined;
          }

          return v.forEachKeyInKeypath(obj, keypath, function(obj, key) {
            if (v.isObject(obj)) {
              return obj[key];
            }
          });
        },

        // This returns an object with all the values of the form.
        // It uses the input name as key and the value as value
        // So for example this:
        // <input type="text" name="email" value="foo@bar.com" />
        // would return:
        // {email: "foo@bar.com"}
        collectFormValues: function(form, options) {
          var values = {}
            , i
            , j
            , input
            , inputs
            , option
            , value;

          if (v.isJqueryElement(form)) {
            form = form[0];
          }

          if (!form) {
            return values;
          }

          options = options || {};

          inputs = form.querySelectorAll("input[name], textarea[name]");
          for (i = 0; i < inputs.length; ++i) {
            input = inputs.item(i);

            if (v.isDefined(input.getAttribute("data-ignored"))) {
              continue;
            }

            var name = input.name.replace(/\./g, "\\\\.");
            value = v.sanitizeFormValue(input.value, options);
            if (input.type === "number") {
              value = value ? +value : null;
            } else if (input.type === "checkbox") {
              if (input.attributes.value) {
                if (!input.checked) {
                  value = values[name] || null;
                }
              } else {
                value = input.checked;
              }
            } else if (input.type === "radio") {
              if (!input.checked) {
                value = values[name] || null;
              }
            }
            values[name] = value;
          }

          inputs = form.querySelectorAll("select[name]");
          for (i = 0; i < inputs.length; ++i) {
            input = inputs.item(i);
            if (v.isDefined(input.getAttribute("data-ignored"))) {
              continue;
            }

            if (input.multiple) {
              value = [];
              for (j in input.options) {
                option = input.options[j];
                 if (option && option.selected) {
                  value.push(v.sanitizeFormValue(option.value, options));
                }
              }
            } else {
              var _val = typeof input.options[input.selectedIndex] !== 'undefined' ? input.options[input.selectedIndex].value : /* istanbul ignore next */ '';
              value = v.sanitizeFormValue(_val, options);
            }
            values[input.name] = value;
          }

          return values;
        },

        sanitizeFormValue: function(value, options) {
          if (options.trim && v.isString(value)) {
            value = value.trim();
          }

          if (options.nullify !== false && value === "") {
            return null;
          }
          return value;
        },

        capitalize: function(str) {
          if (!v.isString(str)) {
            return str;
          }
          return str[0].toUpperCase() + str.slice(1);
        },

        // Remove all errors who's error attribute is empty (null or undefined)
        pruneEmptyErrors: function(errors) {
          return errors.filter(function(error) {
            return !v.isEmpty(error.error);
          });
        },

        // In
        // [{error: ["err1", "err2"], ...}]
        // Out
        // [{error: "err1", ...}, {error: "err2", ...}]
        //
        // All attributes in an error with multiple messages are duplicated
        // when expanding the errors.
        expandMultipleErrors: function(errors) {
          var ret = [];
          errors.forEach(function(error) {
            // Removes errors without a message
            if (v.isArray(error.error)) {
              error.error.forEach(function(msg) {
                ret.push(v.extend({}, error, {error: msg}));
              });
            } else {
              ret.push(error);
            }
          });
          return ret;
        },

        // Converts the error mesages by prepending the attribute name unless the
        // message is prefixed by ^
        convertErrorMessages: function(errors, options) {
          options = options || {};

          var ret = []
            , prettify = options.prettify || v.prettify;
          errors.forEach(function(errorInfo) {
            var error = v.result(errorInfo.error,
                errorInfo.value,
                errorInfo.attribute,
                errorInfo.options,
                errorInfo.attributes,
                errorInfo.globalOptions);

            if (!v.isString(error)) {
              ret.push(errorInfo);
              return;
            }

            if (error[0] === '^') {
              error = error.slice(1);
            } else if (options.fullMessages !== false) {
              error = v.capitalize(prettify(errorInfo.attribute)) + " " + error;
            }
            error = error.replace(/\\\^/g, "^");
            error = v.format(error, {
              value: v.stringifyValue(errorInfo.value, options)
            });
            ret.push(v.extend({}, errorInfo, {error: error}));
          });
          return ret;
        },

        // In:
        // [{attribute: "<attributeName>", ...}]
        // Out:
        // {"<attributeName>": [{attribute: "<attributeName>", ...}]}
        groupErrorsByAttribute: function(errors) {
          var ret = {};
          errors.forEach(function(error) {
            var list = ret[error.attribute];
            if (list) {
              list.push(error);
            } else {
              ret[error.attribute] = [error];
            }
          });
          return ret;
        },

        // In:
        // [{error: "<message 1>", ...}, {error: "<message 2>", ...}]
        // Out:
        // ["<message 1>", "<message 2>"]
        flattenErrorsToArray: function(errors) {
          return errors
            .map(function(error) { return error.error; })
            .filter(function(value, index, self) {
              return self.indexOf(value) === index;
            });
        },

        cleanAttributes: function(attributes, whitelist) {
          function whitelistCreator(obj, key, last) {
            if (v.isObject(obj[key])) {
              return obj[key];
            }
            return (obj[key] = last ? true : {});
          }

          function buildObjectWhitelist(whitelist) {
            var ow = {}
              , attr;
            for (attr in whitelist) {
              if (!whitelist[attr]) {
                continue;
              }
              v.forEachKeyInKeypath(ow, attr, whitelistCreator);
            }
            return ow;
          }

          function cleanRecursive(attributes, whitelist) {
            if (!v.isObject(attributes)) {
              return attributes;
            }

            var ret = v.extend({}, attributes)
              , w
              , attribute;

            for (attribute in attributes) {
              w = whitelist[attribute];

              if (v.isObject(w)) {
                ret[attribute] = cleanRecursive(ret[attribute], w);
              } else if (!w) {
                delete ret[attribute];
              }
            }
            return ret;
          }

          if (!v.isObject(whitelist) || !v.isObject(attributes)) {
            return {};
          }

          whitelist = buildObjectWhitelist(whitelist);
          return cleanRecursive(attributes, whitelist);
        },

        exposeModule: function(validate, root, exports, module, define) {
          if (exports) {
            if (module && module.exports) {
              exports = module.exports = validate;
            }
            exports.validate = validate;
          } else {
            root.validate = validate;
            if (validate.isFunction(define) && define.amd) {
              define([], function () { return validate; });
            }
          }
        },

        warn: function(msg) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[validate.js] " + msg);
          }
        },

        error: function(msg) {
          if (typeof console !== "undefined" && console.error) {
            console.error("[validate.js] " + msg);
          }
        }
      });

      validate.validators = {
        // Presence validates that the value isn't empty
        presence: function(value, options) {
          options = v.extend({}, this.options, options);
          if (options.allowEmpty !== false ? !v.isDefined(value) : v.isEmpty(value)) {
            return options.message || this.message || "can't be blank";
          }
        },
        length: function(value, options, attribute) {
          // Empty values are allowed
          if (!v.isDefined(value)) {
            return;
          }

          options = v.extend({}, this.options, options);

          var is = options.is
            , maximum = options.maximum
            , minimum = options.minimum
            , tokenizer = options.tokenizer || function(val) { return val; }
            , err
            , errors = [];

          value = tokenizer(value);
          var length = value.length;
          if(!v.isNumber(length)) {
            return options.message || this.notValid || "has an incorrect length";
          }

          // Is checks
          if (v.isNumber(is) && length !== is) {
            err = options.wrongLength ||
              this.wrongLength ||
              "is the wrong length (should be %{count} characters)";
            errors.push(v.format(err, {count: is}));
          }

          if (v.isNumber(minimum) && length < minimum) {
            err = options.tooShort ||
              this.tooShort ||
              "is too short (minimum is %{count} characters)";
            errors.push(v.format(err, {count: minimum}));
          }

          if (v.isNumber(maximum) && length > maximum) {
            err = options.tooLong ||
              this.tooLong ||
              "is too long (maximum is %{count} characters)";
            errors.push(v.format(err, {count: maximum}));
          }

          if (errors.length > 0) {
            return options.message || errors;
          }
        },
        numericality: function(value, options, attribute, attributes, globalOptions) {
          // Empty values are fine
          if (!v.isDefined(value)) {
            return;
          }

          options = v.extend({}, this.options, options);

          var errors = []
            , name
            , count
            , checks = {
                greaterThan:          function(v, c) { return v > c; },
                greaterThanOrEqualTo: function(v, c) { return v >= c; },
                equalTo:              function(v, c) { return v === c; },
                lessThan:             function(v, c) { return v < c; },
                lessThanOrEqualTo:    function(v, c) { return v <= c; },
                divisibleBy:          function(v, c) { return v % c === 0; }
              }
            , prettify = options.prettify ||
              (globalOptions && globalOptions.prettify) ||
              v.prettify;

          // Strict will check that it is a valid looking number
          if (v.isString(value) && options.strict) {
            var pattern = "^-?(0|[1-9]\\d*)";
            if (!options.onlyInteger) {
              pattern += "(\\.\\d+)?";
            }
            pattern += "$";

            if (!(new RegExp(pattern).test(value))) {
              return options.message ||
                options.notValid ||
                this.notValid ||
                this.message ||
                "must be a valid number";
            }
          }

          // Coerce the value to a number unless we're being strict.
          if (options.noStrings !== true && v.isString(value) && !v.isEmpty(value)) {
            value = +value;
          }

          // If it's not a number we shouldn't continue since it will compare it.
          if (!v.isNumber(value)) {
            return options.message ||
              options.notValid ||
              this.notValid ||
              this.message ||
              "is not a number";
          }

          // Same logic as above, sort of. Don't bother with comparisons if this
          // doesn't pass.
          if (options.onlyInteger && !v.isInteger(value)) {
            return options.message ||
              options.notInteger ||
              this.notInteger ||
              this.message ||
              "must be an integer";
          }

          for (name in checks) {
            count = options[name];
            if (v.isNumber(count) && !checks[name](value, count)) {
              // This picks the default message if specified
              // For example the greaterThan check uses the message from
              // this.notGreaterThan so we capitalize the name and prepend "not"
              var key = "not" + v.capitalize(name);
              var msg = options[key] ||
                this[key] ||
                this.message ||
                "must be %{type} %{count}";

              errors.push(v.format(msg, {
                count: count,
                type: prettify(name)
              }));
            }
          }

          if (options.odd && value % 2 !== 1) {
            errors.push(options.notOdd ||
                this.notOdd ||
                this.message ||
                "must be odd");
          }
          if (options.even && value % 2 !== 0) {
            errors.push(options.notEven ||
                this.notEven ||
                this.message ||
                "must be even");
          }

          if (errors.length) {
            return options.message || errors;
          }
        },
        datetime: v.extend(function(value, options) {
          if (!v.isFunction(this.parse) || !v.isFunction(this.format)) {
            throw new Error("Both the parse and format functions needs to be set to use the datetime/date validator");
          }

          // Empty values are fine
          if (!v.isDefined(value)) {
            return;
          }

          options = v.extend({}, this.options, options);

          var err
            , errors = []
            , earliest = options.earliest ? this.parse(options.earliest, options) : NaN
            , latest = options.latest ? this.parse(options.latest, options) : NaN;

          value = this.parse(value, options);

          // 86400000 is the number of milliseconds in a day, this is used to remove
          // the time from the date
          if (isNaN(value) || options.dateOnly && value % 86400000 !== 0) {
            err = options.notValid ||
              options.message ||
              this.notValid ||
              "must be a valid date";
            return v.format(err, {value: arguments[0]});
          }

          if (!isNaN(earliest) && value < earliest) {
            err = options.tooEarly ||
              options.message ||
              this.tooEarly ||
              "must be no earlier than %{date}";
            err = v.format(err, {
              value: this.format(value, options),
              date: this.format(earliest, options)
            });
            errors.push(err);
          }

          if (!isNaN(latest) && value > latest) {
            err = options.tooLate ||
              options.message ||
              this.tooLate ||
              "must be no later than %{date}";
            err = v.format(err, {
              date: this.format(latest, options),
              value: this.format(value, options)
            });
            errors.push(err);
          }

          if (errors.length) {
            return v.unique(errors);
          }
        }, {
          parse: null,
          format: null
        }),
        date: function(value, options) {
          options = v.extend({}, options, {dateOnly: true});
          return v.validators.datetime.call(v.validators.datetime, value, options);
        },
        format: function(value, options) {
          if (v.isString(options) || (options instanceof RegExp)) {
            options = {pattern: options};
          }

          options = v.extend({}, this.options, options);

          var message = options.message || this.message || "is invalid"
            , pattern = options.pattern
            , match;

          // Empty values are allowed
          if (!v.isDefined(value)) {
            return;
          }
          if (!v.isString(value)) {
            return message;
          }

          if (v.isString(pattern)) {
            pattern = new RegExp(options.pattern, options.flags);
          }
          match = pattern.exec(value);
          if (!match || match[0].length != value.length) {
            return message;
          }
        },
        inclusion: function(value, options) {
          // Empty values are fine
          if (!v.isDefined(value)) {
            return;
          }
          if (v.isArray(options)) {
            options = {within: options};
          }
          options = v.extend({}, this.options, options);
          if (v.contains(options.within, value)) {
            return;
          }
          var message = options.message ||
            this.message ||
            "^%{value} is not included in the list";
          return v.format(message, {value: value});
        },
        exclusion: function(value, options) {
          // Empty values are fine
          if (!v.isDefined(value)) {
            return;
          }
          if (v.isArray(options)) {
            options = {within: options};
          }
          options = v.extend({}, this.options, options);
          if (!v.contains(options.within, value)) {
            return;
          }
          var message = options.message || this.message || "^%{value} is restricted";
          if (v.isString(options.within[value])) {
            value = options.within[value];
          }
          return v.format(message, {value: value});
        },
        email: v.extend(function(value, options) {
          options = v.extend({}, this.options, options);
          var message = options.message || this.message || "is not a valid email";
          // Empty values are fine
          if (!v.isDefined(value)) {
            return;
          }
          if (!v.isString(value)) {
            return message;
          }
          if (!this.PATTERN.exec(value)) {
            return message;
          }
        }, {
          PATTERN: /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i
        }),
        equality: function(value, options, attribute, attributes, globalOptions) {
          if (!v.isDefined(value)) {
            return;
          }

          if (v.isString(options)) {
            options = {attribute: options};
          }
          options = v.extend({}, this.options, options);
          var message = options.message ||
            this.message ||
            "is not equal to %{attribute}";

          if (v.isEmpty(options.attribute) || !v.isString(options.attribute)) {
            throw new Error("The attribute must be a non empty string");
          }

          var otherValue = v.getDeepObjectValue(attributes, options.attribute)
            , comparator = options.comparator || function(v1, v2) {
              return v1 === v2;
            }
            , prettify = options.prettify ||
              (globalOptions && globalOptions.prettify) ||
              v.prettify;

          if (!comparator(value, otherValue, options, attribute, attributes)) {
            return v.format(message, {attribute: prettify(options.attribute)});
          }
        },
        // A URL validator that is used to validate URLs with the ability to
        // restrict schemes and some domains.
        url: function(value, options) {
          if (!v.isDefined(value)) {
            return;
          }

          options = v.extend({}, this.options, options);

          var message = options.message || this.message || "is not a valid url"
            , schemes = options.schemes || this.schemes || ['http', 'https']
            , allowLocal = options.allowLocal || this.allowLocal || false
            , allowDataUrl = options.allowDataUrl || this.allowDataUrl || false;
          if (!v.isString(value)) {
            return message;
          }

          // https://gist.github.com/dperini/729294
          var regex =
            "^" +
            // protocol identifier
            "(?:(?:" + schemes.join("|") + ")://)" +
            // user:pass authentication
            "(?:\\S+(?::\\S*)?@)?" +
            "(?:";

          var tld = "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))";

          if (allowLocal) {
            tld += "?";
          } else {
            regex +=
              // IP address exclusion
              // private & local networks
              "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
              "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
              "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})";
          }

          regex +=
              // IP address dotted notation octets
              // excludes loopback network 0.0.0.0
              // excludes reserved space >= 224.0.0.0
              // excludes network & broacast addresses
              // (first & last IP address of each class)
              "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
              "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
              "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
            "|" +
              // host name
              "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
              // domain name
              "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
              tld +
            ")" +
            // port number
            "(?::\\d{2,5})?" +
            // resource path
            "(?:[/?#]\\S*)?" +
          "$";

          if (allowDataUrl) {
            // RFC 2397
            var mediaType = "\\w+\\/[-+.\\w]+(?:;[\\w=]+)*";
            var urlchar = "[A-Za-z0-9-_.!~\\*'();\\/?:@&=+$,%]*";
            var dataurl = "data:(?:"+mediaType+")?(?:;base64)?,"+urlchar;
            regex = "(?:"+regex+")|(?:^"+dataurl+"$)";
          }

          var PATTERN = new RegExp(regex, 'i');
          if (!PATTERN.exec(value)) {
            return message;
          }
        },
        type: v.extend(function(value, originalOptions, attribute, attributes, globalOptions) {
          if (v.isString(originalOptions)) {
            originalOptions = {type: originalOptions};
          }

          if (!v.isDefined(value)) {
            return;
          }

          var options = v.extend({}, this.options, originalOptions);

          var type = options.type;
          if (!v.isDefined(type)) {
            throw new Error("No type was specified");
          }

          var check;
          if (v.isFunction(type)) {
            check = type;
          } else {
            check = this.types[type];
          }

          if (!v.isFunction(check)) {
            throw new Error("validate.validators.type.types." + type + " must be a function.");
          }

          if (!check(value, options, attribute, attributes, globalOptions)) {
            var message = originalOptions.message ||
              this.messages[type] ||
              this.message ||
              options.message ||
              (v.isFunction(type) ? "must be of the correct type" : "must be of type %{type}");

            if (v.isFunction(message)) {
              message = message(value, originalOptions, attribute, attributes, globalOptions);
            }

            return v.format(message, {attribute: v.prettify(attribute), type: type});
          }
        }, {
          types: {
            object: function(value) {
              return v.isObject(value) && !v.isArray(value);
            },
            array: v.isArray,
            integer: v.isInteger,
            number: v.isNumber,
            string: v.isString,
            date: v.isDate,
            boolean: v.isBoolean
          },
          messages: {}
        })
      };

      validate.formatters = {
        detailed: function(errors) {return errors;},
        flat: v.flattenErrorsToArray,
        grouped: function(errors) {
          var attr;

          errors = v.groupErrorsByAttribute(errors);
          for (attr in errors) {
            errors[attr] = v.flattenErrorsToArray(errors[attr]);
          }
          return errors;
        },
        constraint: function(errors) {
          var attr;
          errors = v.groupErrorsByAttribute(errors);
          for (attr in errors) {
            errors[attr] = errors[attr].map(function(result) {
              return result.validator;
            }).sort();
          }
          return errors;
        }
      };

      validate.exposeModule(validate, this, exports, module, define);
    }).call(commonjsGlobal,
            /* istanbul ignore next */ exports ,
            /* istanbul ignore next */ module ,
            null);
    });

    /* src/Github.svelte generated by Svelte v3.38.3 */
    const file$8 = "src/Github.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[2] = list[i];
    	return child_ctx;
    }

    // (22:2) {:else}
    function create_else_block$2(ctx) {
    	let div1;
    	let div0;
    	let each_value = /*user*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:gap-x-10 xl-grid-cols-4 gap-y-10 gap-x-6 ");
    			add_location(div0, file$8, 23, 6, 561);
    			attr_dev(div1, "class", " min-h-screen py-32 px-10 ");
    			add_location(div1, file$8, 22, 4, 514);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*user*/ 1) {
    				each_value = /*user*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(22:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (18:2) {#if loaging}
    function create_if_block$2(ctx) {
    	let h1;
    	let i;
    	let t;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			i = element("i");
    			t = text(" Loaging ...");
    			attr_dev(i, "class", "fas fa-spinner fa-pulse ");
    			add_location(i, file$8, 19, 6, 439);
    			attr_dev(h1, "class", "text-2xl");
    			add_location(h1, file$8, 18, 4, 411);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, i);
    			append_dev(h1, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(18:2) {#if loaging}",
    		ctx
    	});

    	return block;
    }

    // (27:8) {#each user as users}
    function create_each_block$1(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let div0;
    	let h1;
    	let a;
    	let t1_value = /*users*/ ctx[2].html_url + "";
    	let t1;
    	let a_href_value;
    	let t2;
    	let t3;
    	let p;
    	let button;
    	let t4_value = /*users*/ ctx[2].login + "";
    	let t4;
    	let t5;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			h1 = element("h1");
    			a = element("a");
    			t1 = text(t1_value);
    			t2 = text(".");
    			t3 = space();
    			p = element("p");
    			button = element("button");
    			t4 = text(t4_value);
    			t5 = space();
    			if (img.src !== (img_src_value = /*users*/ ctx[2].avatar_url)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*users*/ ctx[2].login);
    			attr_dev(img, "class", "rounded-t-lg w-full");
    			add_location(img, file$8, 30, 12, 860);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "href", a_href_value = /*users*/ ctx[2].html_url);
    			add_location(a, file$8, 39, 16, 1187);
    			attr_dev(h1, "class", "md:text-1xl text-xl hover:text-indigo-600 transition duration-200  font-bold text-gray-900 ");
    			add_location(h1, file$8, 36, 14, 1035);
    			add_location(button, file$8, 42, 16, 1347);
    			attr_dev(p, "class", "text-gray-700 my-2 hover-text-900 ");
    			add_location(p, file$8, 41, 14, 1284);
    			attr_dev(div0, "class", "p-6");
    			add_location(div0, file$8, 35, 12, 1003);
    			attr_dev(div1, "class", "container mx-auto shadow-lg rounded-lg max-w-md hover:shadow-2xl transition duration-300");
    			add_location(div1, file$8, 27, 10, 722);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(h1, a);
    			append_dev(a, t1);
    			append_dev(h1, t2);
    			append_dev(div0, t3);
    			append_dev(div0, p);
    			append_dev(p, button);
    			append_dev(button, t4);
    			append_dev(div1, t5);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*user*/ 1 && img.src !== (img_src_value = /*users*/ ctx[2].avatar_url)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*user*/ 1 && img_alt_value !== (img_alt_value = /*users*/ ctx[2].login)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*user*/ 1 && t1_value !== (t1_value = /*users*/ ctx[2].html_url + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*user*/ 1 && a_href_value !== (a_href_value = /*users*/ ctx[2].html_url)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*user*/ 1 && t4_value !== (t4_value = /*users*/ ctx[2].login + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(27:8) {#each user as users}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (/*loaging*/ ctx[1]) return create_if_block$2;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "containe mx-auto");
    			add_location(div, file$8, 16, 0, 360);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Github", slots, []);
    	let user = [];
    	let loaging = true;

    	onMount(async () => {
    		let userData = await fetch("https://api.github.com/users");
    		let gitHubUser = await userData.json();
    		$$invalidate(0, user = gitHubUser);
    		$$invalidate(1, loaging = false);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Github> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ onMount, each, async: validate.async, user, loaging });

    	$$self.$inject_state = $$props => {
    		if ("user" in $$props) $$invalidate(0, user = $$props.user);
    		if ("loaging" in $$props) $$invalidate(1, loaging = $$props.loaging);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [user, loaging];
    }

    class Github extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Github",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/Navbar.svelte generated by Svelte v3.38.3 */

    const file$7 = "src/Navbar.svelte";

    function create_fragment$7(ctx) {
    	let header;
    	let div;
    	let a;
    	let i0;
    	let t0;
    	let span;
    	let t2;
    	let nav;
    	let t3;
    	let button;
    	let i1;
    	let t4;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			header = element("header");
    			div = element("div");
    			a = element("a");
    			i0 = element("i");
    			t0 = space();
    			span = element("span");
    			span.textContent = "Budget Calculator";
    			t2 = space();
    			nav = element("nav");
    			t3 = space();
    			button = element("button");
    			i1 = element("i");
    			t4 = text(" Add Item");
    			attr_dev(i0, "class", "fas fa-shopping-bag fa-2x text-red-600");
    			add_location(i0, file$7, 12, 6, 325);
    			attr_dev(span, "class", "ml-3 text-xl");
    			add_location(span, file$7, 13, 6, 384);
    			attr_dev(a, "href", "https://google.com");
    			attr_dev(a, "class", "flex font-medium items-center text-white mb-4 md:mb-0");
    			add_location(a, file$7, 8, 4, 210);
    			attr_dev(nav, "class", "md:ml-auto md:mr-auto flex flex-wrap items-center text-base justify-center");
    			add_location(nav, file$7, 15, 4, 449);
    			attr_dev(i1, "class", "fas fa-plus-square px-2");
    			add_location(i1, file$7, 22, 6, 738);
    			attr_dev(button, "class", "inline-flex items-center bg-blue-800 border-0 py-1 px-3 focus:outline-none hover:bg-blue-700 rounded text-base mt-4 md:mt-0");
    			add_location(button, file$7, 18, 4, 554);
    			attr_dev(div, "class", "container mx-auto flex flex-wrap p-5 px-32 flex-col md:flex-row items-center");
    			add_location(div, file$7, 5, 2, 108);
    			attr_dev(header, "class", "text-gray-100 body-font shadow-md bg-blue-400");
    			add_location(header, file$7, 4, 0, 43);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div);
    			append_dev(div, a);
    			append_dev(a, i0);
    			append_dev(a, t0);
    			append_dev(a, span);
    			append_dev(div, t2);
    			append_dev(div, nav);
    			append_dev(div, t3);
    			append_dev(div, button);
    			append_dev(button, i1);
    			append_dev(button, t4);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*formOpen*/ ctx[0])) /*formOpen*/ ctx[0].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Navbar", slots, []);
    	let { formOpen } = $$props;
    	const writable_props = ["formOpen"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("formOpen" in $$props) $$invalidate(0, formOpen = $$props.formOpen);
    	};

    	$$self.$capture_state = () => ({ formOpen });

    	$$self.$inject_state = $$props => {
    		if ("formOpen" in $$props) $$invalidate(0, formOpen = $$props.formOpen);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [formOpen];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { formOpen: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment$7.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*formOpen*/ ctx[0] === undefined && !("formOpen" in props)) {
    			console.warn("<Navbar> was created without expected prop 'formOpen'");
    		}
    	}

    	get formOpen() {
    		throw new Error("<Navbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set formOpen(value) {
    		throw new Error("<Navbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Title.svelte generated by Svelte v3.38.3 */

    const file$6 = "src/Title.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let h1;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t = text(/*title*/ ctx[0]);
    			attr_dev(h1, "class", "text-2xl text-blue-500");
    			add_location(h1, file$6, 5, 2, 73);
    			attr_dev(div, "class", "main");
    			add_location(div, file$6, 4, 0, 52);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, t);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*title*/ 1) set_data_dev(t, /*title*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Title", slots, []);
    	let { title = "default" } = $$props;
    	const writable_props = ["title"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Title> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	$$self.$capture_state = () => ({ title });

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title];
    }

    class Title extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { title: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Title",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get title() {
    		throw new Error("<Title>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Title>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Total.svelte generated by Svelte v3.38.3 */

    const file$5 = "src/Total.svelte";

    function create_fragment$5(ctx) {
    	let h1;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("Expense Total: $ ");
    			t1 = text(/*total*/ ctx[0]);
    			attr_dev(h1, "class", "text-2xl text-blue-500");
    			add_location(h1, file$5, 4, 0, 44);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*total*/ 1) set_data_dev(t1, /*total*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Total", slots, []);
    	let { total = 0 } = $$props;
    	const writable_props = ["total"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Total> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("total" in $$props) $$invalidate(0, total = $$props.total);
    	};

    	$$self.$capture_state = () => ({ total });

    	$$self.$inject_state = $$props => {
    		if ("total" in $$props) $$invalidate(0, total = $$props.total);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [total];
    }

    class Total extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { total: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Total",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get total() {
    		throw new Error("<Total>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set total(value) {
    		throw new Error("<Total>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicInOut(t) {
        return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    }
    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }
    function quadIn(t) {
        return t * t;
    }

    function blur(node, { delay = 0, duration = 400, easing = cubicInOut, amount = 5, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const f = style.filter === 'none' ? '' : style.filter;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `opacity: ${target_opacity - (od * u)}; filter: ${f} blur(${u * amount}px);`
        };
    }
    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }
    function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const sd = 1 - start;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
        };
    }

    /* src/Expense.svelte generated by Svelte v3.38.3 */
    const file$4 = "src/Expense.svelte";

    // (28:4) {#if displayAmount}
    function create_if_block$1(ctx) {
    	let h3;
    	let t0;
    	let t1;
    	let h3_intro;
    	let h3_outro;
    	let current;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t0 = text("Amount: ");
    			t1 = text(/*amount*/ ctx[2]);
    			attr_dev(h3, "class", "text-base my-3 text-blue-500");
    			add_location(h3, file$4, 28, 6, 802);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h3, anchor);
    			append_dev(h3, t0);
    			append_dev(h3, t1);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (!current || dirty & /*amount*/ 4) set_data_dev(t1, /*amount*/ ctx[2]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (h3_outro) h3_outro.end(1);

    				if (!h3_intro) h3_intro = create_in_transition(h3, fly, {
    					duration: 1000,
    					x: 0,
    					y: 50,
    					delay: 50,
    					easing: quadIn
    				});

    				h3_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (h3_intro) h3_intro.invalidate();
    			h3_outro = create_out_transition(h3, fly, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    			if (detaching && h3_outro) h3_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(28:4) {#if displayAmount}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let article;
    	let div0;
    	let h1;
    	let t0;
    	let t1;
    	let button0;
    	let i0;
    	let t2;
    	let t3;
    	let div1;
    	let button1;
    	let i1;
    	let t4;
    	let button2;
    	let i2;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*displayAmount*/ ctx[3] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			article = element("article");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			button0 = element("button");
    			i0 = element("i");
    			t2 = space();
    			if (if_block) if_block.c();
    			t3 = space();
    			div1 = element("div");
    			button1 = element("button");
    			i1 = element("i");
    			t4 = space();
    			button2 = element("button");
    			i2 = element("i");
    			attr_dev(i0, "class", "fas px-1 fa-caret-down text-blue-500");
    			add_location(i0, file$4, 24, 9, 695);
    			add_location(button0, file$4, 23, 6, 654);
    			attr_dev(h1, "class", "text-1xl font-bold capitalize");
    			add_location(h1, file$4, 21, 4, 592);
    			attr_dev(div0, "class", "expenses-info");
    			add_location(div0, file$4, 20, 2, 560);
    			attr_dev(i1, "class", "fas px-2 fa-edit text-green-600");
    			add_location(i1, file$4, 46, 7, 1157);
    			add_location(button1, file$4, 45, 4, 1104);
    			attr_dev(i2, "class", "fas fa-trash text-red-600");
    			add_location(i2, file$4, 49, 7, 1264);
    			add_location(button2, file$4, 48, 4, 1221);
    			attr_dev(div1, "class", "expenses-buttons");
    			add_location(div1, file$4, 44, 2, 1069);
    			attr_dev(article, "class", "p-3 flex justify-between items-center bg-gray-100 rounded-md my-2 shadow-sm ");
    			add_location(article, file$4, 17, 0, 460);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, article, anchor);
    			append_dev(article, div0);
    			append_dev(div0, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, button0);
    			append_dev(button0, i0);
    			append_dev(div0, t2);
    			if (if_block) if_block.m(div0, null);
    			append_dev(article, t3);
    			append_dev(article, div1);
    			append_dev(div1, button1);
    			append_dev(button1, i1);
    			append_dev(div1, t4);
    			append_dev(div1, button2);
    			append_dev(button2, i2);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*toggleAmount*/ ctx[6], false, false, false),
    					listen_dev(button1, "click", /*click_handler*/ ctx[7], false, false, false),
    					listen_dev(button2, "click", /*click_handler_1*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (/*displayAmount*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*displayAmount*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Expense", slots, []);
    	let { name = "" } = $$props;
    	let { id } = $$props;
    	let { amount = null } = $$props;

    	// export let removeItem;
    	let displayAmount = false;

    	const { remove } = getContext("state");
    	const setModifyExpense = getContext("modify");

    	const toggleAmount = () => {
    		$$invalidate(3, displayAmount = !displayAmount);
    	};

    	const writable_props = ["name", "id", "amount"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Expense> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => setModifyExpense(id);
    	const click_handler_1 = () => remove(id);

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    		if ("amount" in $$props) $$invalidate(2, amount = $$props.amount);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		blur,
    		fly,
    		fade,
    		slide,
    		scale,
    		quadIn,
    		name,
    		id,
    		amount,
    		displayAmount,
    		remove,
    		setModifyExpense,
    		toggleAmount
    	});

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    		if ("id" in $$props) $$invalidate(1, id = $$props.id);
    		if ("amount" in $$props) $$invalidate(2, amount = $$props.amount);
    		if ("displayAmount" in $$props) $$invalidate(3, displayAmount = $$props.displayAmount);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		id,
    		amount,
    		displayAmount,
    		remove,
    		setModifyExpense,
    		toggleAmount,
    		click_handler,
    		click_handler_1
    	];
    }

    class Expense extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { name: 0, id: 1, amount: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Expense",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*id*/ ctx[1] === undefined && !("id" in props)) {
    			console.warn("<Expense> was created without expected prop 'id'");
    		}
    	}

    	get name() {
    		throw new Error("<Expense>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Expense>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Expense>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Expense>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get amount() {
    		throw new Error("<Expense>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set amount(value) {
    		throw new Error("<Expense>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function flip(node, animation, params = {}) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        const scaleX = animation.from.width / node.clientWidth;
        const scaleY = animation.from.height / node.clientHeight;
        const dx = (animation.from.left - animation.to.left) / scaleX;
        const dy = (animation.from.top - animation.to.top) / scaleY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
        return {
            delay,
            duration: is_function(duration) ? duration(d) : duration,
            easing,
            css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
        };
    }

    /* src/ExpenseList.svelte generated by Svelte v3.38.3 */
    const file$3 = "src/ExpenseList.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[0] = list[i];
    	child_ctx[2] = i;
    	return child_ctx;
    }

    // (19:2) {:else}
    function create_else_block$1(ctx) {
    	let h1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Current is not have expenses";
    			attr_dev(h1, "class", "text-xl font-bold text-center");
    			add_location(h1, file$3, 19, 4, 478);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(19:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (11:2) {#each expenses as expenses, index (expenses.id)}
    function create_each_block(key_1, ctx) {
    	let div;
    	let expense;
    	let t;
    	let div_intro;
    	let div_outro;
    	let rect;
    	let stop_animation = noop;
    	let current;
    	const expense_spread_levels = [/*expenses*/ ctx[0]];
    	let expense_props = {};

    	for (let i = 0; i < expense_spread_levels.length; i += 1) {
    		expense_props = assign(expense_props, expense_spread_levels[i]);
    	}

    	expense = new Expense({ props: expense_props, $$inline: true });

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			div = element("div");
    			create_component(expense.$$.fragment);
    			t = space();
    			add_location(div, file$3, 11, 4, 311);
    			this.first = div;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(expense, div, null);
    			append_dev(div, t);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			const expense_changes = (dirty & /*expenses*/ 1)
    			? get_spread_update(expense_spread_levels, [get_spread_object(/*expenses*/ ctx[0])])
    			: {};

    			expense.$set(expense_changes);
    		},
    		r: function measure() {
    			rect = div.getBoundingClientRect();
    		},
    		f: function fix() {
    			fix_position(div);
    			stop_animation();
    			add_transform(div, rect);
    		},
    		a: function animate() {
    			stop_animation();
    			stop_animation = create_animation(div, rect, flip, {});
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(expense.$$.fragment, local);

    			add_render_callback(() => {
    				if (div_outro) div_outro.end(1);

    				if (!div_intro) div_intro = create_in_transition(div, fly, {
    					x: 200,
    					delay: (/*index*/ ctx[2] + 1) * 500
    				});

    				div_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(expense.$$.fragment, local);
    			if (div_intro) div_intro.invalidate();
    			div_outro = create_out_transition(div, fly, { x: -200 });
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(expense);
    			if (detaching && div_outro) div_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(11:2) {#each expenses as expenses, index (expenses.id)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let section;
    	let title;
    	let t;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let current;

    	title = new Title({
    			props: { title: "List Expense" },
    			$$inline: true
    		});

    	let each_value = /*expenses*/ ctx[0];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*expenses*/ ctx[0].id;
    	validate_each_keys(ctx, each_value, get_each_context, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block$1(ctx);
    	}

    	const block = {
    		c: function create() {
    			section = element("section");
    			create_component(title.$$.fragment);
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			add_location(section, file$3, 8, 0, 212);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			mount_component(title, section, null);
    			append_dev(section, t);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*expenses*/ 1) {
    				each_value = /*expenses*/ ctx[0];
    				validate_each_argument(each_value);
    				group_outros();
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
    				validate_each_keys(ctx, each_value, get_each_context, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, section, fix_and_outro_and_destroy_block, create_each_block, null, get_each_context);
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
    				check_outros();

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block$1(ctx);
    					each_1_else.c();
    					each_1_else.m(section, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(title.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(title.$$.fragment, local);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_component(title);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (each_1_else) each_1_else.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ExpenseList", slots, []);
    	let { expenses = [] } = $$props;
    	const writable_props = ["expenses"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ExpenseList> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("expenses" in $$props) $$invalidate(0, expenses = $$props.expenses);
    	};

    	$$self.$capture_state = () => ({ Title, Expense, fly, flip, expenses });

    	$$self.$inject_state = $$props => {
    		if ("expenses" in $$props) $$invalidate(0, expenses = $$props.expenses);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [expenses];
    }

    class ExpenseList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { expenses: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ExpenseList",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get expenses() {
    		throw new Error("<ExpenseList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set expenses(value) {
    		throw new Error("<ExpenseList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var ExpenseDate = [
      {
        id: Math.random() * Date.now(),
        name: "rent",
        amount: 100
      },
      {
        id: Math.random() * Date.now(),
        name: "car payment",
        amount: 1000
      },
      {
        id: Math.random() * Date.now(),
        name: "student loan",
        amount: 120
      },
      {
        id: Math.random() * Date.now(),
        name: "credit card",
        amount: 550
      }
    ];

    /* src/ExpenseForm.svelte generated by Svelte v3.38.3 */
    const file$2 = "src/ExpenseForm.svelte";

    // (51:4) {#if emptyValue}
    function create_if_block_1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Please fill all field this form";
    			attr_dev(p, "class", "text-red-500 mx-auto py-3");
    			add_location(p, file$2, 51, 6, 1257);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(51:4) {#if emptyValue}",
    		ctx
    	});

    	return block;
    }

    // (59:37) {:else}
    function create_else_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Add Expense");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(59:37) {:else}",
    		ctx
    	});

    	return block;
    }

    // (59:7) {#if isEditing}
    function create_if_block(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Edite Expense");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(59:7) {#if isEditing}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let form;
    	let button0;
    	let i;
    	let t0;
    	let t1;
    	let title_1;
    	let t2;
    	let div;
    	let label0;
    	let t4;
    	let input0;
    	let t5;
    	let label1;
    	let t7;
    	let input1;
    	let t8;
    	let t9;
    	let button1;
    	let current;
    	let mounted;
    	let dispose;

    	title_1 = new Title({
    			props: { title: "Add Expense" },
    			$$inline: true
    		});

    	let if_block0 = /*emptyValue*/ ctx[4] && create_if_block_1(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*isEditing*/ ctx[2]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			form = element("form");
    			button0 = element("button");
    			i = element("i");
    			t0 = text(" Close");
    			t1 = space();
    			create_component(title_1.$$.fragment);
    			t2 = space();
    			div = element("div");
    			label0 = element("label");
    			label0.textContent = "Title:";
    			t4 = space();
    			input0 = element("input");
    			t5 = space();
    			label1 = element("label");
    			label1.textContent = "Price:";
    			t7 = space();
    			input1 = element("input");
    			t8 = space();
    			if (if_block0) if_block0.c();
    			t9 = space();
    			button1 = element("button");
    			if_block1.c();
    			attr_dev(i, "class", "fas fa-times");
    			add_location(i, file$2, 32, 4, 678);
    			attr_dev(button0, "class", "focus:outline-none text-red-600 float-right");
    			add_location(button0, file$2, 28, 2, 581);
    			attr_dev(label0, "for", "name");
    			attr_dev(label0, "class", "font-bold");
    			add_location(label0, file$2, 36, 4, 789);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "name", "title");
    			attr_dev(input0, "class", "px-1 py-1 focus:outline-none border-b-2 border-0 mb-3 focus:ring-0  w-full");
    			add_location(input0, file$2, 37, 4, 844);
    			attr_dev(label1, "for", "name");
    			attr_dev(label1, "class", "font-bold");
    			add_location(label1, file$2, 43, 4, 1013);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "name", "amount");
    			attr_dev(input1, "class", "px-1 py-1 focus:outline-none border-b-2 border-0  focus:ring-0 w-full");
    			add_location(input1, file$2, 44, 4, 1068);
    			attr_dev(button1, "type", "submit");
    			attr_dev(button1, "class", "w-auto py-2  rounded-md border-2 blue uppercase border-blue-600 bg-write hover:bg-blue-500 hover:text-white transition delay-200  text-blue-600 my-3 svelte-dcidp");
    			toggle_class(button1, "disable", /*emptyValue*/ ctx[4]);
    			add_location(button1, file$2, 54, 4, 1345);
    			attr_dev(div, "class", "flex flex-col");
    			add_location(div, file$2, 35, 2, 757);
    			attr_dev(form, "action", "");
    			attr_dev(form, "class", "my-5 px-5 w-full ");
    			add_location(form, file$2, 23, 0, 489);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, button0);
    			append_dev(button0, i);
    			append_dev(button0, t0);
    			append_dev(form, t1);
    			mount_component(title_1, form, null);
    			append_dev(form, t2);
    			append_dev(form, div);
    			append_dev(div, label0);
    			append_dev(div, t4);
    			append_dev(div, input0);
    			set_input_value(input0, /*title*/ ctx[0]);
    			append_dev(div, t5);
    			append_dev(div, label1);
    			append_dev(div, t7);
    			append_dev(div, input1);
    			set_input_value(input1, /*amount*/ ctx[1]);
    			append_dev(div, t8);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t9);
    			append_dev(div, button1);
    			if_block1.m(button1, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*formClose*/ ctx[3])) /*formClose*/ ctx[3].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[9]),
    					listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[5]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*title*/ 1 && input0.value !== /*title*/ ctx[0]) {
    				set_input_value(input0, /*title*/ ctx[0]);
    			}

    			if (dirty & /*amount*/ 2 && input1.value !== /*amount*/ ctx[1]) {
    				set_input_value(input1, /*amount*/ ctx[1]);
    			}

    			if (/*emptyValue*/ ctx[4]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(div, t9);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(button1, null);
    				}
    			}

    			if (dirty & /*emptyValue*/ 16) {
    				toggle_class(button1, "disable", /*emptyValue*/ ctx[4]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(title_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(title_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			destroy_component(title_1);
    			if (if_block0) if_block0.d();
    			if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let emptyValue;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("ExpenseForm", slots, []);
    	let { title = "" } = $$props;
    	let { amount = null } = $$props;
    	let { isEditing } = $$props;
    	let { formClose } = $$props;
    	let { editExpense } = $$props;
    	let { addExpense } = $$props;

    	const handleSubmit = () => {
    		if (isEditing) {
    			editExpense({ title, amount });
    		} else {
    			addExpense({ title, amount });
    		}

    		$$invalidate(0, title = "");
    		$$invalidate(1, amount = null);
    		formClose();
    	};

    	const writable_props = ["title", "amount", "isEditing", "formClose", "editExpense", "addExpense"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ExpenseForm> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		title = this.value;
    		$$invalidate(0, title);
    	}

    	function input1_input_handler() {
    		amount = this.value;
    		$$invalidate(1, amount);
    	}

    	$$self.$$set = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("amount" in $$props) $$invalidate(1, amount = $$props.amount);
    		if ("isEditing" in $$props) $$invalidate(2, isEditing = $$props.isEditing);
    		if ("formClose" in $$props) $$invalidate(3, formClose = $$props.formClose);
    		if ("editExpense" in $$props) $$invalidate(6, editExpense = $$props.editExpense);
    		if ("addExpense" in $$props) $$invalidate(7, addExpense = $$props.addExpense);
    	};

    	$$self.$capture_state = () => ({
    		Validate: validate,
    		Title,
    		title,
    		amount,
    		isEditing,
    		formClose,
    		editExpense,
    		addExpense,
    		handleSubmit,
    		emptyValue
    	});

    	$$self.$inject_state = $$props => {
    		if ("title" in $$props) $$invalidate(0, title = $$props.title);
    		if ("amount" in $$props) $$invalidate(1, amount = $$props.amount);
    		if ("isEditing" in $$props) $$invalidate(2, isEditing = $$props.isEditing);
    		if ("formClose" in $$props) $$invalidate(3, formClose = $$props.formClose);
    		if ("editExpense" in $$props) $$invalidate(6, editExpense = $$props.editExpense);
    		if ("addExpense" in $$props) $$invalidate(7, addExpense = $$props.addExpense);
    		if ("emptyValue" in $$props) $$invalidate(4, emptyValue = $$props.emptyValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*title, amount*/ 3) {
    			$$invalidate(4, emptyValue = !title || !amount);
    		}
    	};

    	return [
    		title,
    		amount,
    		isEditing,
    		formClose,
    		emptyValue,
    		handleSubmit,
    		editExpense,
    		addExpense,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class ExpenseForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			title: 0,
    			amount: 1,
    			isEditing: 2,
    			formClose: 3,
    			editExpense: 6,
    			addExpense: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ExpenseForm",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isEditing*/ ctx[2] === undefined && !("isEditing" in props)) {
    			console.warn("<ExpenseForm> was created without expected prop 'isEditing'");
    		}

    		if (/*formClose*/ ctx[3] === undefined && !("formClose" in props)) {
    			console.warn("<ExpenseForm> was created without expected prop 'formClose'");
    		}

    		if (/*editExpense*/ ctx[6] === undefined && !("editExpense" in props)) {
    			console.warn("<ExpenseForm> was created without expected prop 'editExpense'");
    		}

    		if (/*addExpense*/ ctx[7] === undefined && !("addExpense" in props)) {
    			console.warn("<ExpenseForm> was created without expected prop 'addExpense'");
    		}
    	}

    	get title() {
    		throw new Error("<ExpenseForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<ExpenseForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get amount() {
    		throw new Error("<ExpenseForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set amount(value) {
    		throw new Error("<ExpenseForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isEditing() {
    		throw new Error("<ExpenseForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isEditing(value) {
    		throw new Error("<ExpenseForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get formClose() {
    		throw new Error("<ExpenseForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set formClose(value) {
    		throw new Error("<ExpenseForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get editExpense() {
    		throw new Error("<ExpenseForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set editExpense(value) {
    		throw new Error("<ExpenseForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get addExpense() {
    		throw new Error("<ExpenseForm>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set addExpense(value) {
    		throw new Error("<ExpenseForm>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Modal.svelte generated by Svelte v3.38.3 */
    const file$1 = "src/Modal.svelte";
    const get_footer_slot_changes = dirty => ({});
    const get_footer_slot_context = ctx => ({});
    const get_title_slot_changes = dirty => ({});
    const get_title_slot_context = ctx => ({});

    function create_fragment$1(ctx) {
    	let div8;
    	let div7;
    	let div0;
    	let t0;
    	let span;
    	let t2;
    	let div6;
    	let div4;
    	let div3;
    	let div2;
    	let h3;
    	let t3;
    	let div1;
    	let p;
    	let div1_transition;
    	let t4;
    	let div5;
    	let div8_intro;
    	let div8_outro;
    	let current;
    	const title_slot_template = /*#slots*/ ctx[1].title;
    	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[0], get_title_slot_context);
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);
    	const footer_slot_template = /*#slots*/ ctx[1].footer;
    	const footer_slot = create_slot(footer_slot_template, ctx, /*$$scope*/ ctx[0], get_footer_slot_context);

    	const block = {
    		c: function create() {
    			div8 = element("div");
    			div7 = element("div");
    			div0 = element("div");
    			t0 = space();
    			span = element("span");
    			span.textContent = "​";
    			t2 = space();
    			div6 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			h3 = element("h3");
    			if (title_slot) title_slot.c();
    			t3 = space();
    			div1 = element("div");
    			p = element("p");
    			if (default_slot) default_slot.c();
    			t4 = space();
    			div5 = element("div");
    			if (footer_slot) footer_slot.c();
    			attr_dev(div0, "class", "fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity");
    			attr_dev(div0, "aria-hidden", "true");
    			add_location(div0, file$1, 26, 4, 656);
    			attr_dev(span, "class", "hidden sm:inline-block sm:align-middle sm:h-screen");
    			attr_dev(span, "aria-hidden", "true");
    			add_location(span, file$1, 32, 4, 856);
    			attr_dev(h3, "class", "text-lg leading-6 font-medium text-gray-900");
    			attr_dev(h3, "id", "modal-title");
    			add_location(h3, file$1, 53, 12, 1728);
    			attr_dev(p, "class", "text-sm text-gray-500");
    			add_location(p, file$1, 60, 14, 1970);
    			attr_dev(div1, "class", "mt-2");
    			add_location(div1, file$1, 59, 12, 1909);
    			attr_dev(div2, "class", "mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left");
    			add_location(div2, file$1, 52, 10, 1656);
    			attr_dev(div3, "class", "");
    			add_location(div3, file$1, 51, 8, 1631);
    			attr_dev(div4, "class", "bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4");
    			add_location(div4, file$1, 50, 6, 1570);
    			attr_dev(div5, "class", "bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse");
    			add_location(div5, file$1, 67, 6, 2118);
    			attr_dev(div6, "class", "inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full");
    			add_location(div6, file$1, 47, 4, 1386);
    			attr_dev(div7, "class", "flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0");
    			add_location(div7, file$1, 13, 2, 268);
    			attr_dev(div8, "class", "fixed z-10 inset-0 overflow-y-auto");
    			attr_dev(div8, "aria-labelledby", "modal-title");
    			attr_dev(div8, "role", "dialog");
    			attr_dev(div8, "aria-modal", "true");
    			add_location(div8, file$1, 5, 0, 125);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div8, anchor);
    			append_dev(div8, div7);
    			append_dev(div7, div0);
    			append_dev(div7, t0);
    			append_dev(div7, span);
    			append_dev(div7, t2);
    			append_dev(div7, div6);
    			append_dev(div6, div4);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, h3);

    			if (title_slot) {
    				title_slot.m(h3, null);
    			}

    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, p);

    			if (default_slot) {
    				default_slot.m(p, null);
    			}

    			append_dev(div6, t4);
    			append_dev(div6, div5);

    			if (footer_slot) {
    				footer_slot.m(div5, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (title_slot) {
    				if (title_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot(title_slot, title_slot_template, ctx, /*$$scope*/ ctx[0], !current ? -1 : dirty, get_title_slot_changes, get_title_slot_context);
    				}
    			}

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[0], !current ? -1 : dirty, null, null);
    				}
    			}

    			if (footer_slot) {
    				if (footer_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot(footer_slot, footer_slot_template, ctx, /*$$scope*/ ctx[0], !current ? -1 : dirty, get_footer_slot_changes, get_footer_slot_context);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(title_slot, local);
    			transition_in(default_slot, local);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fly, { y: 200 }, true);
    				div1_transition.run(1);
    			});

    			transition_in(footer_slot, local);

    			add_render_callback(() => {
    				if (div8_outro) div8_outro.end(1);
    				if (!div8_intro) div8_intro = create_in_transition(div8, blur, {});
    				div8_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(title_slot, local);
    			transition_out(default_slot, local);
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, fly, { y: 200 }, false);
    			div1_transition.run(0);
    			transition_out(footer_slot, local);
    			if (div8_intro) div8_intro.invalidate();
    			div8_outro = create_out_transition(div8, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div8);
    			if (title_slot) title_slot.d(detaching);
    			if (default_slot) default_slot.d(detaching);
    			if (detaching && div1_transition) div1_transition.end();
    			if (footer_slot) footer_slot.d(detaching);
    			if (detaching && div8_outro) div8_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Modal", slots, ['title','default','footer']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("$$scope" in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ fly, blur, fade });
    	return [$$scope, slots];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.38.3 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let navbar;
    	let t;
    	let main;
    	let github;
    	let current;

    	navbar = new Navbar({
    			props: { formOpen: /*formOpen*/ ctx[0] },
    			$$inline: true
    		});

    	github = new Github({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t = space();
    			main = element("main");
    			create_component(github.$$.fragment);
    			attr_dev(main, "class", "container  mx-auto px-32 mt-5");
    			add_location(main, file, 102, 0, 2260);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, main, anchor);
    			mount_component(github, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(github.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(github.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(main);
    			destroy_component(github);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let isEditing;
    	let total;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let expenses = [];
    	let isShowForm = false;
    	let { setId = null } = $$props;
    	let { setName = "" } = $$props;
    	let { setAmount = null } = $$props;

    	// Show form
    	const formOpen = () => {
    		isShowForm = true;
    	};

    	const formClose = () => {
    		isShowForm = false;
    		$$invalidate(1, setId = null);
    		$$invalidate(2, setName = "");
    		$$invalidate(3, setAmount = null);
    	};

    	// Add Expense
    	const addExpense = ({ title, amount }) => {
    		let expense = {
    			id: Math.random() * Date.now(),
    			name: title,
    			amount
    		};

    		$$invalidate(4, expenses = [expense, ...expenses]);
    	};

    	// Modified Expense
    	const modifiedExpense = id => {
    		let expense = expenses.find(item => item.id === id);
    		$$invalidate(1, setId = expense.id);
    		$$invalidate(2, setName = expense.name);
    		$$invalidate(3, setAmount = expense.amount);
    		formOpen();
    	};

    	// Edit expense
    	const editExpense = ({ title, amount }) => {
    		$$invalidate(4, expenses = expenses.map(item => {
    			return item.id === setId
    			? { ...item, name: title, amount }
    			: { ...item };
    		}));

    		$$invalidate(1, setId = null);
    		$$invalidate(2, setName = "");
    		$$invalidate(3, setAmount = null);
    	};

    	const removeItem = id => {
    		$$invalidate(4, expenses = expenses.filter(item => item.id !== id));
    	};

    	const state = {
    		name: "simple name here",
    		remove: removeItem
    	};

    	const clearExpensesAll = () => {
    		$$invalidate(4, expenses = []);
    	};

    	setContext("state", state);
    	setContext("modify", modifiedExpense);

    	//  Set localStorage
    	const setlocalStorage = () => {
    		localStorage.setItem("expenses", JSON.stringify(expenses));
    	};

    	onMount(() => {
    		$$invalidate(4, expenses = localStorage.getItem("expenses")
    		? JSON.parse(localStorage.getItem("expenses"))
    		: []);
    	});

    	afterUpdate(() => {
    		setlocalStorage();
    	});

    	const writable_props = ["setId", "setName", "setAmount"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("setId" in $$props) $$invalidate(1, setId = $$props.setId);
    		if ("setName" in $$props) $$invalidate(2, setName = $$props.setName);
    		if ("setAmount" in $$props) $$invalidate(3, setAmount = $$props.setAmount);
    	};

    	$$self.$capture_state = () => ({
    		setContext,
    		onMount,
    		afterUpdate,
    		Github,
    		Navbar,
    		Title,
    		Totals: Total,
    		ExpenseList,
    		ExpenseDate,
    		ExpenseForm,
    		Modal,
    		expenses,
    		isShowForm,
    		setId,
    		setName,
    		setAmount,
    		formOpen,
    		formClose,
    		addExpense,
    		modifiedExpense,
    		editExpense,
    		removeItem,
    		state,
    		clearExpensesAll,
    		setlocalStorage,
    		isEditing,
    		total
    	});

    	$$self.$inject_state = $$props => {
    		if ("expenses" in $$props) $$invalidate(4, expenses = $$props.expenses);
    		if ("isShowForm" in $$props) isShowForm = $$props.isShowForm;
    		if ("setId" in $$props) $$invalidate(1, setId = $$props.setId);
    		if ("setName" in $$props) $$invalidate(2, setName = $$props.setName);
    		if ("setAmount" in $$props) $$invalidate(3, setAmount = $$props.setAmount);
    		if ("isEditing" in $$props) isEditing = $$props.isEditing;
    		if ("total" in $$props) total = $$props.total;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*setId*/ 2) {
    			// reactive
    			isEditing = setId ? true : false;
    		}

    		if ($$self.$$.dirty & /*expenses*/ 16) {
    			total = expenses.reduce(
    				(acc, curr) => {
    					return acc += JSON.parse(curr.amount);
    				},
    				0
    			);
    		}
    	};

    	return [formOpen, setId, setName, setAmount, expenses];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { setId: 1, setName: 2, setAmount: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get setId() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set setId(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setName() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set setName(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setAmount() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set setAmount(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
