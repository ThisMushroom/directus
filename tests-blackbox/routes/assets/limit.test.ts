import config, { getUrl } from '@common/config';
import request from 'supertest';
import vendors from '@common/get-dbs-to-test';
import { createReadStream } from 'fs';
import path from 'path';
import * as common from '@common/index';

const assetsDirectory = [__dirname, '..', '..', 'assets'];
const storages = ['local'];
const imageFile = {
	name: 'directus.png',
	type: 'image/png',
	filesize: '7136',
};
const imageFilePath = path.join(...assetsDirectory, imageFile.name);

describe('/assets', () => {
	describe('GET /assets/:id', () => {
		describe('ASSETS_TRANSFORM_MAX_CONCURRENT Tests', () => {
			describe('passes when below limit', () => {
				describe.each(storages)('Storage: %s', (storage) => {
					it.each(vendors)(
						'%s',
						async (vendor) => {
							// Setup
							const count = Number(config.envs[vendor].ASSETS_TRANSFORM_MAX_CONCURRENT);
							const uploadedFileID = (
								await request(getUrl(vendor))
									.post('/files')
									.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
									.attach('file', createReadStream(imageFilePath))
									.field('storage', storage)
							).body.data.id;

							// Action
							const responses = await Promise.all(
								Array(count)
									.fill(0)
									.map((_, index) =>
										request(getUrl(vendor))
											.get(`/assets/${uploadedFileID}?width=${4000 + index}&height=${4000 + index}`)
											.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
									)
							);

							// Assert
							for (const response of responses) {
								expect(response.statusCode).toBe(200);
							}
						},
						60000
					);
				});
			});

			describe('errors when above limit', () => {
				describe.each(storages)('Storage: %s', (storage) => {
					it.each(vendors)(
						'%s',
						async (vendor) => {
							// Setup
							const attempts = 100;
							const uploadedFileID = (
								await request(getUrl(vendor))
									.post('/files')
									.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
									.attach('file', createReadStream(imageFilePath))
									.field('storage', storage)
							).body.data.id;

							// Action
							const responses = await Promise.all(
								Array(attempts)
									.fill(0)
									.map((_, index) =>
										request(getUrl(vendor))
											.get(`/assets/${uploadedFileID}?width=${4000 + index}&height=${4000 + index}`)
											.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
									)
							);

							// Assert
							const unavailableCount = responses.filter((response) => response.statusCode === 503).length;
							expect(unavailableCount).toBeGreaterThanOrEqual(attempts / 2);
							expect(responses.filter((response) => response.statusCode === 200).length).toBe(
								attempts - unavailableCount
							);
						},
						1200000
					);
				});
			});
		});
	});
});
