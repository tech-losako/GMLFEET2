// Shared GMFLEET Supabase adapter. It keeps the site working with localStorage
// until real Supabase credentials are added in supabase-config.js.
(function () {
    const config = window.GMFLEET_SUPABASE_CONFIG || {};
    const hasCredentials = Boolean(config.url && config.anonKey && window.supabase?.createClient);
    const client = hasCredentials ? window.supabase.createClient(config.url, config.anonKey) : null;

    const TABLES = {
        applications: 'applications',
        vehicles: 'vehicles',
        payments: 'payments'
    };

    const toIsoDate = (value) => {
        if (!value) return new Date().toISOString().slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
        const parts = String(value).split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return new Date().toISOString().slice(0, 10);
    };

    const toFrDate = (value) => {
        if (!value) return new Date().toLocaleDateString('fr-FR');
        if (String(value).includes('/')) return value;
        return new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR');
    };

    const appFromDb = (row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        address: row.address || '',
        experience: row.experience || '',
        coBorrowerName: row.co_borrower_name || '',
        coBorrowerPhone: row.co_borrower_phone || '',
        coBorrowerAddress: row.co_borrower_address || '',
        duration: row.plan_duration_months ? String(row.plan_duration_months) : '',
        vehicle: row.vehicle,
        date: toFrDate(row.created_on),
        status: row.status,
        note: row.note || '',
        licenseFileName: row.license_file_name || ''
    });

    const appToDb = (app) => ({
        name: app.name,
        phone: app.phone,
        address: app.address || null,
        experience: app.experience || null,
        co_borrower_name: app.coBorrowerName || null,
        co_borrower_phone: app.coBorrowerPhone || null,
        co_borrower_address: app.coBorrowerAddress || null,
        plan_duration_months: app.duration ? Number(app.duration) : null,
        vehicle: app.vehicle,
        created_on: toIsoDate(app.date),
        status: app.status || 'En attente',
        note: app.note || null,
        license_file_name: app.licenseFileName || null
    });

    const vehicleFromDb = (row) => ({
        id: row.id,
        model: row.model,
        plate: row.plate,
        status: row.status,
        driver: row.driver || '—'
    });

    const vehicleToDb = (vehicle) => ({
        model: vehicle.model,
        plate: vehicle.plate,
        status: vehicle.status || 'Disponible',
        driver: vehicle.driver && vehicle.driver !== '—' ? vehicle.driver : null
    });

    const paymentFromDb = (row) => ({
        id: row.id,
        driverId: row.driver_id,
        driverName: row.driver_name,
        amount: Number(row.amount),
        date: row.paid_on,
        method: row.method,
        ref: row.reference
    });

    const paymentToDb = (payment) => ({
        driver_id: payment.driverId || null,
        driver_name: payment.driverName,
        amount: Number(payment.amount),
        paid_on: payment.date,
        method: payment.method,
        reference: payment.ref
    });

    async function selectRows(table, mapper, orderColumn = 'created_at') {
        if (!client) return null;
        const { data, error } = await client.from(table).select('*').order(orderColumn, { ascending: false });
        if (error) throw error;
        return data.map(mapper);
    }

    async function insertRow(table, payload, mapper) {
        if (!client) return null;
        const { data, error } = await client.from(table).insert(payload).select().single();
        if (error) throw error;
        return mapper(data);
    }

    async function updateRow(table, id, payload, mapper) {
        if (!client) return null;
        const { data, error } = await client.from(table).update(payload).eq('id', id).select().single();
        if (error) throw error;
        return mapper(data);
    }

    async function deleteRow(table, id) {
        if (!client) return null;
        const { error } = await client.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
    }

    window.GMFleetBackend = {
        client,
        isConfigured: () => Boolean(client),

        async signIn(email, password) {
            if (!client) return { localOnly: true };
            return client.auth.signInWithPassword({ email, password });
        },

        async getSession() {
            if (!client) return { data: { session: null }, error: null };
            return client.auth.getSession();
        },

        async signOut() {
            if (!client) return;
            await client.auth.signOut();
        },

        async listApplications() {
            return selectRows(TABLES.applications, appFromDb, 'created_at');
        },

        async createApplication(app) {
            if (!client) return null;
            const payload = appToDb(app);
            const { data: sessionData } = await client.auth.getSession();

            if (sessionData.session) {
                return insertRow(TABLES.applications, payload, appFromDb);
            }

            const { error } = await client.from(TABLES.applications).insert(payload);
            if (error) throw error;
            return app;
        },

        async updateApplicationStatus(id, status) {
            return updateRow(TABLES.applications, id, { status }, appFromDb);
        },

        async listVehicles() {
            return selectRows(TABLES.vehicles, vehicleFromDb, 'created_at');
        },

        async createVehicle(vehicle) {
            return insertRow(TABLES.vehicles, vehicleToDb(vehicle), vehicleFromDb);
        },

        async updateVehicleStatus(id, status) {
            return updateRow(TABLES.vehicles, id, { status }, vehicleFromDb);
        },

        async deleteVehicle(id) {
            return deleteRow(TABLES.vehicles, id);
        },

        async listPayments() {
            return selectRows(TABLES.payments, paymentFromDb, 'created_at');
        },

        async createPayment(payment) {
            return insertRow(TABLES.payments, paymentToDb(payment), paymentFromDb);
        }
    };
})();