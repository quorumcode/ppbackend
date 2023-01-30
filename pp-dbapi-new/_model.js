
const mysql_client = require('pp-mysql/client');
const {
    Q, q, qlike,
    $exe,
    $tbl,
    $one,
} = mysql_client.shorthands();


// returns [multicol, sql_fields]
const mk_rfields = (fieldspec) => {
    if (Array.isArray(fieldspec)) {
        // ["field", "field", ...]
        if (!fieldspec.length) throw new Error("mk_rfields: fields may not be empty array");
        // do a sanity check for every item is a string?
        return [true, Q(fieldspec)]; // "many" columns
    }
    if (null == fieldspec) {
        // null or undefined
        return [true, "*"]; // "many" columns
    }
    const t = typeof fieldspec;
    if (("string" == t) || (fieldspec instanceof String)) {
        // "field"
        return [false, Q(fieldspec)]; // "single" column
    }
    if ("object" != t) {
        // checked for null/undefined earlier, other things are not valid
        throw new Error("mk_rfields: Not supported (typeof fieldspec == \""+t+"\"");
    }
    const list = [];
    for (const [alias, field] of Object.entries(fieldspec)) {
        list.push(`${Q(field)} as ${Q(alias)}`);
    }
    if (!list.length) throw new Error("mk_rfields: fieldspec may not be empty object");
    return [true, list.join(", ")]; // "many" columns
};


// returns [multirow, sql_where]
const mk_where = (field, spec, flatspec = true, forceempty = true) => {
    if (field) {
        if (Array.isArray(spec)) {
            // [val, val, ...]
            // obvious "always false" mark: empty array => no matches
            return [true, `(${Q(field)} IN (${q(spec.length || null)}))`];
        }
        switch (typeof spec) {
            case "string":
            case "number":
            case "bigint":
            case "boolean":
                return [false, `(${Q(field)} = ${q(spec)})`];

            case "object": // null and any other non-primitive
                if (null === spec) {
                    // obvious "always false" mark: null value => no matches
                    // (this is "equal" by design, not "equal or is null")
                    return [false, `(${Q(field)} = NULL)`];
                }
                break;

            case "symbol":
            case "function":
            case "undefined":
                // not supported (undefined behavior)
                throw new Error("mk_match: Not supported (typeof spec == \""+(typeof spec)+"\"");
        }
        switch (true) {
            case spec instanceof String:
            case spec instanceof Number:
            case spec instanceof BigInt:
            case spec instanceof Boolean:
                if (!field) throw new Error("mk_where: spec is a (wrapped) primitive, but field is not specified");
                return [false, `(${Q(field)} = ${q(spec)})`];

            case spec instanceof Date:
                // trying to be timezone-agnostic a well as not losing precision
                return [false, `(${Q(field)} = FROM_UNIXTIME(CAST(${q(Number(spec))} as decimal(20, 3)) / 1000))`];
        }
    }
    if (flatspec) {
        throw new Error("mk_where: Forbidden (spec may not be key-value object for this context)");
    }
    let r_multirow = new Set;
    const r_sql = [];
    for (const [field, spec] of Object.entries(spec)) {
        const [multirow, sql] = mk_where(field, spec, true, true);
        r_multirow.add(multirow);
        r_sql.push(sql);
    }
    if (!r_sql.length) {
        return forceempty
            ? [null, "NULL"] // obvious "always false" mark: no conditions => no matches
            : [null, "1"]
        ;
    }
    return [
        r_multirow.size > 1 ? null : r_multirow.values()[0],
        r_sql.join(" AND "),
    ];
};




const Model = {
    // query records optionally satisfying condition
    // opts.tbl     target table
    // opts.where   optional filtering condition specification
    // opts.rf      field(s) specification (read)
    async find(opts) {
        const tbl = opts.tbl;

        const [multicol, sql_fields] = mk_rfields(opts.rf);
        const [multirow, sql_where] = mk_where(null, opts.where, false, false);

        const sql = `SELECT ${sql_fields} FROM ${Q(tbl)} WHERE ${sql_where}`;

        // multirow flag is ignored: there are always "many" items by design
        const $fn = multicol ? $tbl : $col;
        //return await $fn(sql);
        return await $exe(sql);
    },

    // query records by primary key
    // opts.tbl     target table
    // opts.pk      primary key field name
    // opts.ids     id(s) listing
    // opts.where   optional filtering condition specification
    // opts.rf      field(s) specification (read)
    async mget(opts) {
        const tbl = opts.tbl;
        const pk = opts.pk ?? "id";

        const [multicol, sql_fields] = mk_rfields(opts.rf);
        const [multirow, sql_where] = mk_where(false, { ...(opts.pk ? { [pk]: ids } : null), ...(opts.and ?? null) }, true, true);

        const sql = `SELECT ${sql_fields} FROM ${Q(tbl)} WHERE ${sql_where}`;

        // multirow flag is ignored: there are always "many" items by design
        const $fn = multicol ? $tbl : $col;
        //return await $fn(sql);
        return await $exe(sql);
    },

    // create/update by pk
    // opts.tbl     target table
    // opts.pk      primary key field name
    // opts.wf      field(s) specification (write)
    async set(opts) {
        const tbl = opts.tbl;
        const pk = opts.pk ?? "id";
        const xx = opts.xx ?? null;

        const sql_pk = Q(pk);
        const sql_id = q(id);
        const sql_values = q(opts.wf);
        const sql_pk_add = sql_values.length ? ", " : "";

        let sql = "";
        switch (xx) {
            case true: // should exist
                sql = `
                    UPDATE ${Q(tbl)} SET
                    ${sql_pk} = ${q(id)}${sql_pk_add}${sql_values}
                    WHERE ${sql_pk} = ${sql_id}
                `;
                break;

            case false: // must not exist
                sql = `
                    INSERT INTO ${Q(tbl)} SET
                    ${sql_pk} = ${q(id)}${sql_pk_add}${sql_values}
                `;
                break;

            case null: // doesnt matter
                sql = `
                    INSERT INTO ${Q(tbl)} SET
                    ${sql_pk} = ${q(id)}${sql_pk_add}${sql_values}
                    ON DUPLICATE KEY UPDATE
                    ${sql_pk} = LAST_INSERT_ID(sql_pk)${sql_pk_add}${sql_values}
                `;
                break;

            default: throw new Error("not understand xx = "+JSON.stringify(xx));
        }
        const r = await $exe(sql);
        return /* ... */;
    },

    // create by pk (record MUST not exist)
    async add(opts, id, update_fieldspec) {
        return Model.set({ ...opts, xx: false }, id, update_fieldspec);
    },

    // update by pk (record SHOULD exist)
    async upd(opts, id, update_fieldspec) {
        return Model.set({ ...opts, xx: true }, id, update_fieldspec);
    },

    // delete by pk
    async del(opts, id) {
        const tbl = opts.tbl;
        const pk = opts.pk ?? "id";
        //const xx = opts.xx ?? null;

        const sql = `DELETE FROM ${Q(tbl)} WHERE ${Q(pk)} = ${q(id)}`;
        const r = await $exe(sql);
        return /* ... */;
    },
};

Object.assign(module.exports, {
    Model,
});

/*
    try {
        const { ModelLoan } = require('aws-layer/dbapi/_model');
        let r = await ModelLoan.mget("1646908216214-5HkcNJX5JPL98JZQ3LuNO");
        console.log({ r });
    }
    catch (err) {
        console.error(err);
    }
*/
